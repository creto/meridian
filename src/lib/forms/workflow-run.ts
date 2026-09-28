import { evalBool } from "./expressions.ts";
import { joinReady, scheduleTimer, splitParallel, timerDue } from "./gateways.ts";
import { uid } from "./ids.ts";
import { submissionPdf, sha256Bytes } from "./pdf.ts";
import { inputLabels } from "./schema-export.ts";
import { interpolatePath } from "../storage/http.ts";
import { lookupConnection } from "../storage/connection-cache.ts";
import { readLocalObject, saveLocalObject } from "../storage/local.ts";
import type { FormDefinition, Submission, SubmissionStatus, WorkflowState } from "./types.ts";

export function edgeTo(form: FormDefinition, from: string, when: string): string | null {
  return form.workflow?.edges.find((edge) => edge.from === from && (edge.when ?? "approved") === when)?.to ?? null;
}

function pickDecision(form: FormDefinition, from: string, data: Record<string, unknown>): string | null {
  const edges = form.workflow?.edges.filter((edge) => edge.from === from) ?? [];
  for (const edge of edges) {
    const when = edge.when ?? "approved";
    if (when === "approved" || when === "rejected") continue;
    if (evalBool(when, { ...data, data }, false)) return edge.to;
  }
  return edges.find((edge) => (edge.when ?? "approved") === "approved")?.to ?? null;
}

function automatic(type: string | undefined): boolean {
  return type === "service" || type === "http" || type === "webhook" || type === "decision";
}

async function ensurePdf(form: FormDefinition, submission: Submission) {
  const existing = submission.documents.find((doc) => doc.kind === "filled-pdf" && !doc.error);
  if (existing) {
    const stored = await readLocalObject(existing.id);
    if (stored.ok) return { doc: existing, bytes: stored.body };
  }
  const pdf = await submissionPdf({
    title: form.title,
    name: form.name,
    version: submission.formVersion,
    submissionId: submission.id,
    data: submission.data,
    labels: inputLabels(form),
  });
  const id = uid("doc");
  const saved = await saveLocalObject(id, pdf.bytes, "application/pdf");
  const doc = {
    id,
    filename: `${form.name}-${submission.id}.pdf`,
    sha256: saved.ok ? saved.sha256 : pdf.sha256,
    bytes: pdf.bytes.byteLength,
    createdAt: new Date().toISOString(),
    kind: "filled-pdf" as const,
    provider: "local",
    connectionId: form.targets?.pdfConnectionId || "conn_local",
    path: `local/${id}`,
    formVersion: submission.formVersion,
    pdfTemplateVersion: 1,
    generatedPdfHash: saved.ok ? saved.sha256 : pdf.sha256,
    error: saved.ok ? undefined : saved.message,
  };
  return { doc, bytes: pdf.bytes };
}

async function pushRemote(
  form: FormDefinition,
  submission: Submission,
  filename: string,
  bytes: Uint8Array,
  contentType: string,
  slot: "archive" | "pdf" | "submission",
) {
  const declared = form.storage?.provider;
  const connectionId = slot === "pdf"
    ? form.targets?.pdfConnectionId
    : slot === "submission"
      ? form.targets?.submissionConnectionId
      : form.targets?.archiveConnectionId;
  const template = slot === "pdf"
    ? (form.targets?.pdfPathTemplate || form.targets?.pathTemplate || form.storage?.pathTemplate || "/pdf/")
    : (form.targets?.pathTemplate || form.storage?.pathTemplate || "/archive/");
  const path = `${interpolatePath(template, submission.data)}${filename}`.replace(/\/{2,}/g, "/");
  const conn = connectionId ? lookupConnection(connectionId) : undefined;
  if (connectionId && connectionId !== "conn_local") {
    if (!conn || !conn.enabled) return { ok: false as const, message: "The selected storage connection is missing or disabled" };
    if (!conn.lastTest?.ok) return { ok: false as const, message: `${conn.name} has not passed Test connection. The upload was not attempted.` };
    try {
      const response = await fetch("/api/storage/put", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId,
          kind: conn.kind,
          config: conn.config,
          key: path.replace(/^\/+/, ""),
          contentType,
          bodyBase64: encodeBase64(bytes),
        }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string; externalId?: string; url?: string; path?: string; provider?: string };
      if (!response.ok || !json.ok) return { ok: false as const, message: json.message || `Storage returned HTTP ${response.status}` };
      return { ok: true as const, provider: json.provider || conn.kind, path: json.path || path, externalId: json.externalId, url: json.url, connectionId };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "Storage request failed" };
    }
  }
  if (slot === "archive" && declared && declared !== "workspace-archive" && !connectionId) {
    return {
      ok: false as const,
      message: `${declared} is named on this form, but no storage connection is selected. Add one under Admin, then choose it in the form's storage settings.`,
    };
  }
  return { ok: true as const, provider: "local", path, connectionId: "conn_local" };
}

function encodeBase64(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(out);
}

export async function advanceServices(form: FormDefinition, submission: Submission, actor: string): Promise<Submission> {
  if (!form.workflow || !submission.workflow) return submission;
  let current = submission.workflow.currentNode;
  const history = submission.workflow.history.slice();
  const documents = submission.documents.slice();
  let waitUntil = submission.workflow.waitUntil;
  let tokens = submission.workflow.tokens;
  for (let guard = 0; guard < 8; guard += 1) {
    const node = form.workflow.nodes.find((item) => item.id === current);
    if (!node) break;
    if (node.type === "timer") {
      if (!waitUntil) {
        const plan = scheduleTimer(node.delayMs ?? 0);
        if (!plan.fireNow && plan.waitUntil) {
          history.push({ node: node.id, at: new Date().toISOString(), action: "timer-scheduled", actor, note: plan.waitUntil });
          waitUntil = plan.waitUntil;
          break;
        }
      } else if (!timerDue(waitUntil)) {
        break;
      }
      history.push({ node: node.id, at: new Date().toISOString(), action: "timer-fired", actor });
      waitUntil = undefined;
      const next = edgeTo(form, node.id, "approved");
      if (!next) break;
      current = next;
      continue;
    }
    if (node.type === "parallel") {
      if (!tokens?.length) {
        tokens = splitParallel(form, node.id);
        history.push({ node: node.id, at: new Date().toISOString(), action: "split", actor, note: `${tokens.length} branches` });
      }
      const gate = joinReady(form, tokens);
      if (gate.ready && gate.next) {
        history.push({ node: gate.joinId ?? node.id, at: new Date().toISOString(), action: "joined", actor, note: "all" });
        tokens = tokens.map((token) => (token.nodeId === gate.joinId ? { ...token, status: "done" as const } : token));
        current = gate.next;
        continue;
      }
      const active = tokens.find((token) => token.status === "active");
      if (active) current = active.nodeId;
      break;
    }
    if (node.type === "join") {
      const gate = joinReady(form, tokens ?? []);
      if (gate.ready && gate.next) {
        history.push({ node: node.id, at: new Date().toISOString(), action: "joined", actor });
        current = gate.next;
        continue;
      }
      history.push({ node: node.id, at: new Date().toISOString(), action: "waiting-join", actor });
      break;
    }
    if (!automatic(node.type)) break;
    if (node.type === "decision") {
      const next = pickDecision(form, node.id, submission.data);
      history.push({ node: node.id, at: new Date().toISOString(), action: next ? "decision" : "decision-stopped", actor, note: next ? undefined : "No edge matched" });
      if (!next) break;
      current = next;
      continue;
    }
    const service = node.service ?? (node.type === "http" ? "http" : node.type === "webhook" ? "webhook" : "pdf");
    if (service === "http" || service === "webhook" || node.type === "http" || node.type === "webhook") {
      if (!node.url) {
        history.push({ node: node.id, at: new Date().toISOString(), action: "http-failed", actor, note: "No URL configured" });
        break;
      }
      try {
        const response = await fetch(node.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ submissionId: submission.id, form: form.name, data: submission.data }),
        });
        history.push({ node: node.id, at: new Date().toISOString(), action: response.ok ? "http-called" : "http-failed", actor, note: `HTTP ${response.status}` });
        if (!response.ok) break;
      } catch (error) {
        history.push({ node: node.id, at: new Date().toISOString(), action: "http-failed", actor, note: error instanceof Error ? error.message : "Request failed" });
        break;
      }
    } else if (service === "archive" || service === "storage") {
      const pdf = await ensurePdf(form, submission);
      if (!documents.some((doc) => doc.id === pdf.doc.id)) documents.push(pdf.doc);
      const remote = await pushRemote(form, submission, pdf.doc.filename, pdf.bytes, "application/pdf", "archive");
      const pdfDest = form.targets?.pdfConnectionId;
      const pdfRemote = pdfDest && pdfDest !== form.targets?.archiveConnectionId
        ? await pushRemote(form, submission, pdf.doc.filename, pdf.bytes, "application/pdf", "pdf")
        : remote;
      const jsonBytes = new TextEncoder().encode(JSON.stringify({ id: submission.id, form: form.name, version: submission.formVersion, data: submission.data }));
      const jsonRemote = form.targets?.submissionConnectionId
        ? await pushRemote(form, submission, `${submission.id}.json`, jsonBytes, "application/json", "submission")
        : { ok: true as const, provider: "local", path: "workspace", connectionId: "conn_local" as string | undefined, externalId: undefined as string | undefined, url: undefined as string | undefined };
      const index = documents.findIndex((doc) => doc.id === pdf.doc.id);
      if (index >= 0) {
        const currentDoc = documents[index]!;
        documents[index] = remote.ok
          ? { ...currentDoc, provider: remote.provider, path: remote.path, externalId: remote.externalId, externalUrl: remote.url, connectionId: remote.connectionId, error: pdfRemote.ok ? undefined : pdfRemote.message }
          : { ...currentDoc, error: remote.message };
      }
      if (jsonRemote.ok && form.targets?.submissionConnectionId) {
        documents.push({
          id: uid("doc"),
          filename: `${submission.id}.json`,
          sha256: await sha256Bytes(jsonBytes),
          bytes: jsonBytes.byteLength,
          createdAt: new Date().toISOString(),
          kind: "attachment",
          provider: jsonRemote.provider,
          path: jsonRemote.path,
          connectionId: jsonRemote.connectionId,
          externalId: jsonRemote.externalId,
          externalUrl: jsonRemote.url,
        });
      }
      const failed = !remote.ok ? remote.message : !pdfRemote.ok ? pdfRemote.message : !jsonRemote.ok ? jsonRemote.message : undefined;
      history.push({
        node: node.id,
        at: new Date().toISOString(),
        action: failed ? "storage-failed" : "archived",
        actor,
        note: failed ?? remote.path,
      });
      if (failed) break;
    } else {
      const pdf = await ensurePdf(form, submission);
      if (!documents.some((doc) => doc.id === pdf.doc.id)) documents.push(pdf.doc);
      history.push({ node: node.id, at: new Date().toISOString(), action: pdf.doc.error ? "pdf-failed" : "pdf-generated", actor, note: pdf.doc.sha256 });
      if (pdf.doc.error) break;
    }
    const next = edgeTo(form, node.id, "approved");
    if (!next) break;
    current = next;
  }
  const landed = form.workflow.nodes.find((item) => item.id === current);
  let status: SubmissionStatus = submission.status;
  if (landed?.type === "end") status = /reject/i.test(landed.title) || landed.id === "rejected" ? "rejected" : "approved";
  else if (landed?.type === "human" || landed?.type === "approval") status = "in_review";
  return { ...submission, documents, status, updatedAt: new Date().toISOString(), workflow: { currentNode: current, history, waitUntil, tokens } };
}

export function startWorkflow(form: FormDefinition, actor: string): WorkflowState | undefined {
  if (!form.workflow) return undefined;
  const start = form.workflow.nodes.find((node) => node.type === "start") ?? form.workflow.nodes[0];
  if (!start) return undefined;
  const next = edgeTo(form, start.id, "approved") ?? start.id;
  return {
    currentNode: next,
    history: [{ node: start.id, at: new Date().toISOString(), action: "started", actor }],
  };
}
