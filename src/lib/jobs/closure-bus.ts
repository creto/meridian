import { createHash, randomBytes } from "node:crypto";
import { rowsToXlsx, type SubmissionFilter } from "../search/export-job.ts";
import { renderNotice, type NoticeName, type NoticeMessage } from "../notify/provider.ts";
import { planDocument, type GeneratedDocument } from "../pdf/generated-docs.ts";

export type BusStatus = "queued" | "running" | "retrying" | "failed" | "dead" | "completed" | "cancelled";

export interface BusJob {
  id: string;
  tenantId: string;
  type: "export" | "notification" | "pdf";
  status: BusStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
}

export interface BusState {
  jobs: BusJob[];
  sent: NoticeMessage[];
  documents: GeneratedDocument[];
  files: Map<string, Buffer>;
}

export function emptyBus(): BusState {
  return { jobs: [], sent: [], documents: [], files: new Map() };
}

function id(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function enqueue(state: BusState, job: Omit<BusJob, "id" | "status" | "attempts" | "lastError" | "result">): BusJob {
  const row: BusJob = { ...job, id: id("job"), status: "queued", attempts: 0, lastError: null, result: null };
  state.jobs.push(row);
  return row;
}

export interface ExportSource {
  rows: Array<Record<string, unknown> & { id: string; created_at: string }>;
}

function matchExport(row: ExportSource["rows"][number], filter: SubmissionFilter): boolean {
  if (filter.formId && row.form_id !== filter.formId) return false;
  if (filter.status && row.status !== filter.status) return false;
  if (filter.text && !JSON.stringify(row).toLowerCase().includes(filter.text.toLowerCase())) return false;
  return true;
}

function runExport(job: BusJob, source: ExportSource, state: BusState): Record<string, unknown> {
  const filter = job.payload.filter as SubmissionFilter;
  const rows = source.rows.filter((row) => matchExport(row, filter));
  const book = rowsToXlsx(rows);
  const key = `${job.tenantId}/${job.id}.xlsx`;
  state.files.set(key, book);
  return { key, rows: rows.length, sha256: createHash("sha256").update(book).digest("hex"), bytes: book.length };
}

function runNotice(job: BusJob, state: BusState): Record<string, unknown> {
  const name = String(job.payload.template ?? "task_assignment") as NoticeName;
  const vars = (job.payload.vars ?? {}) as Record<string, string>;
  const rendered = renderNotice(name, vars);
  const message: NoticeMessage = {
    to: String(job.payload.to ?? ""),
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    secretRef: typeof job.payload.secretRef === "string" ? job.payload.secretRef : undefined,
  };
  if (!message.to.includes("@")) throw new Error("Notification is missing a recipient");
  if (message.secretRef && !message.secretRef.startsWith("secret:")) throw new Error("Provider credential must be a secret reference");
  state.sent.push(message);
  return { to: message.to, subject: message.subject };
}

function runPdf(job: BusJob, state: BusState): Record<string, unknown> {
  const bytes = Buffer.from(String(job.payload.pdf ?? "%PDF-1.4\n"));
  const doc = planDocument({
    tenantId: job.tenantId,
    submissionId: String(job.payload.submissionId ?? "sub"),
    formVersionId: Number(job.payload.formVersionId ?? 1),
    pdfTemplateVersionId: job.payload.templateVersion == null ? null : Number(job.payload.templateVersion),
    pdfBytes: bytes,
    createdBy: String(job.payload.createdBy ?? "system"),
    storageProvider: "memory",
    externalReference: null,
    status: "stored",
  });
  state.documents.push(doc);
  state.files.set(doc.documentId, bytes);
  return { documentId: doc.documentId, generatedHash: doc.generatedHash };
}

export function pump(state: BusState, source: ExportSource, limit = 10): { ran: number; dead: number } {
  let ran = 0;
  let dead = 0;
  for (const job of state.jobs) {
    if (ran >= limit) break;
    if (job.status !== "queued" && job.status !== "retrying") continue;
    job.status = "running";
    job.attempts += 1;
    try {
      if (job.type === "export") job.result = runExport(job, source, state);
      else if (job.type === "notification") job.result = runNotice(job, state);
      else job.result = runPdf(job, state);
      job.status = "completed";
      job.lastError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      job.lastError = message;
      if (job.attempts >= job.maxAttempts) {
        job.status = "dead";
        dead += 1;
      } else {
        job.status = "retrying";
      }
    }
    ran += 1;
  }
  return { ran, dead };
}

export function cancelBusJob(state: BusState, id: string): boolean {
  const job = state.jobs.find((item) => item.id === id);
  if (!job) return false;
  if (job.status !== "queued" && job.status !== "retrying") return false;
  job.status = "cancelled";
  return true;
}

export function retryBusJob(state: BusState, id: string): boolean {
  const job = state.jobs.find((item) => item.id === id);
  if (!job || job.status !== "dead") return false;
  job.status = "queued";
  job.attempts = 0;
  job.lastError = null;
  return true;
}
