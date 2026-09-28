import { create } from "zustand";
import { persist } from "zustand/middleware";
import { can, type WorkspaceRole } from "../platform/rbac.ts";
import type { StorageConnection } from "../storage/types.ts";
import { rememberConnections } from "../storage/connection-cache.ts";
import { validateForm } from "./engine.ts";
import { settleCaptcha } from "./captcha.ts";
import { uid } from "./ids.ts";
import { lintBlocksPublish, lintForm, type LintIssue } from "./lint.ts";
import { incidentForm, supplierForm } from "./templates.ts";
import { mapComponents } from "./tree.ts";
import type { FormDefinition, FormVersion, IdempotencyRecord, Submission } from "./types.ts";
import { applyHumanAction } from "./gateways.ts";
import { advanceServices, startWorkflow } from "./workflow-run.ts";

export interface PaletteCommand {
  id: string;
  label: string;
  group?: string;
  run: () => void;
}

interface SubmitInput {
  formId: string;
  data: Record<string, unknown>;
  actor: string;
  draft?: boolean;
  existingId?: string;
  idempotencyKey?: string;
  source?: "human" | "agent";
}

interface SubmitResult {
  ok: boolean;
  code?: string;
  message?: string;
  errors?: Record<string, string>;
  submission?: Submission;
}

interface FormState {
  hydrated: boolean;
  workspaceName: string;
  actorName: string;
  role: WorkspaceRole;
  forms: FormDefinition[];
  submissions: Submission[];
  idempotency: IdempotencyRecord[];
  connections: StorageConnection[];
  audit: AuditEvent[];
  webhooks: WebhookEndpoint[];
  createOpen: boolean;
  serverRevision: number;
  palette: PaletteCommand[];
  setHydrated: (value: boolean) => void;
  setCreateOpen: (open: boolean) => void;
  setActorName: (name: string) => void;
  setWorkspaceName: (name: string) => void;
  setRole: (role: WorkspaceRole) => void;
  setPalette: (commands: PaletteCommand[]) => void;
  upsertConnection: (connection: StorageConnection) => void;
  removeConnection: (id: string) => void;
  upsertWebhook: (hook: WebhookEndpoint) => void;
  removeWebhook: (id: string) => void;
  addForm: (form: FormDefinition) => void;
  updateForm: (id: string, recipe: (form: FormDefinition) => FormDefinition, message?: string) => void;
  publishForm: (id: string, note: string) => { ok: boolean; issues: LintIssue[] };
  restoreVersion: (id: string, version: number) => void;
  duplicateForm: (id: string) => string | null;
  setStatus: (id: string, status: FormDefinition["status"]) => void;
  submit: (input: SubmitInput) => Promise<SubmitResult>;
  workflowAction: (submissionId: string, action: "approve" | "reject" | "changes", note: string) => Promise<{ ok: boolean; message?: string }>;
  removeSubmission: (id: string) => void;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secretSet: boolean;
}

export const LOCAL_CONNECTION: StorageConnection = {
  id: "conn_local",
  name: "Workspace archive",
  kind: "local",
  enabled: true,
  config: {},
  secretSet: false,
};

const hits: number[] = [];

function fanout(hooks: { id: string; url: string; events: string[]; enabled: boolean }[] | undefined, event: string, payload: unknown) {
  for (const hook of hooks ?? []) {
    if (!hook.enabled || (hook.events.length > 0 && !hook.events.includes(event))) continue;
    void fetch("/api/hooks/deliver", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ webhookId: hook.id, url: hook.url, event, payload }),
    });
  }
}

function allowAgent(): boolean {
  const now = Date.now();
  while (hits.length && hits[0] != null && now - hits[0] > 60_000) hits.shift();
  if (hits.length >= 30) return false;
  hits.push(now);
  return true;
}

function daysAgo(days: number, hours = 10): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hours, 15, 0, 0);
  return date.toISOString();
}

function stripKeys(components: FormDefinition["components"], keys: string[]): FormDefinition["components"] {
  const drop = new Set(keys);
  const walk = (list: FormDefinition["components"]): FormDefinition["components"] =>
    list
      .filter((component) => !drop.has(component.key))
      .map((component) => ({
        ...component,
        components: component.components ? walk(component.components) : undefined,
        columns: component.columns?.map((col) => ({ ...col, components: walk(col.components) })),
      }));
  return walk(components);
}

function seed(): Pick<FormState, "workspaceName" | "actorName" | "forms" | "submissions" | "idempotency"> {
  const supplier = supplierForm();
  const v1components = stripKeys(supplier.components, ["taxId"]);
  const v2components = mapComponents(supplier.components, (component) =>
    component.key === "bankName" || component.key === "accountNumber" ? { ...component, conditional: undefined } : component,
  );
  const versions: FormVersion[] = [
    { version: 1, savedAt: daysAgo(20), note: "Initial supplier form", title: supplier.title, display: "wizard", components: v1components, workflow: supplier.workflow },
    { version: 2, savedAt: daysAgo(11), note: "Added tax ID for foreign suppliers", title: supplier.title, display: "wizard", components: v2components, workflow: supplier.workflow },
    { version: 3, savedAt: daysAgo(4), note: "Bank fields only when paying by transfer", title: supplier.title, display: "wizard", components: supplier.components, workflow: supplier.workflow },
  ];
  supplier.versions = versions;
  supplier.publishedAt = daysAgo(4);
  supplier.createdAt = daysAgo(20);
  supplier.updatedAt = daysAgo(4);
  supplier.activity = [
    { at: daysAgo(4, 11), actor: "Ana", message: "Bank fields now depend on payment method" },
    { at: daysAgo(11, 9), actor: "Ana", message: "Added Tax ID" },
    { at: daysAgo(18, 16), actor: "Meridian", message: "Turned the form into a 4-step wizard" },
    { at: daysAgo(20, 8), actor: "Carlos", message: "Started from the supplier template" },
  ];
  const incident = incidentForm();
  incident.createdAt = daysAgo(2);
  incident.updatedAt = daysAgo(1);
  incident.activity = [{ at: daysAgo(1), actor: "Alex Rivera", message: "Drafted severity and injury follow-up" }];

  const base = (partial: Omit<Submission, "formId" | "formName" | "documents" | "revisions"> & { revisions?: Submission["revisions"] }): Submission => ({
    documents: [],
    revisions: partial.revisions ?? [],
    formId: supplier.id,
    formName: supplier.name,
    ...partial,
  });

  const submissions: Submission[] = [
    base({
      id: "sub_acme",
      formVersion: 3,
      createdAt: daysAgo(1, 9),
      updatedAt: daysAgo(1, 9),
      status: "in_review",
      data: {
        supplierType: "colombian_company",
        legalName: "Andes Mill SAS",
        country: "CO",
        nit: "900445112-3",
        taxId: "",
        address: { line1: "Cra 7 # 71-21", city: "Bogotá", region: "DC", postalCode: "110231", country: "CO" },
        repName: "Lucia Herrera",
        repEmail: "lucia@andesmill.example",
        repPhone: "+57 601 555 0199",
        paymentMethod: "transfer",
        bankName: "Bancolombia",
        accountNumber: "031-884421",
        certifications: [{ name: "ISO 9001", issuer: "Icontec", expires: "2027-04-01" }],
      },
      workflow: {
        currentNode: "procurement",
        history: [{ node: "start", at: daysAgo(1, 9), action: "started", actor: "Lucia Herrera" }],
      },
    }),
    base({
      id: "sub_globex",
      formVersion: 3,
      createdAt: daysAgo(2, 14),
      updatedAt: daysAgo(0, 11),
      status: "in_review",
      data: {
        supplierType: "foreign",
        legalName: "Globex Trading",
        country: "US",
        nit: "",
        taxId: "98-4451201",
        address: { line1: "18 Howard St", city: "San Francisco", region: "CA", postalCode: "94105", country: "US" },
        repName: "",
        repEmail: "ap@globex.example",
        repPhone: "+1 415 555 0144",
        paymentMethod: "check",
        bankName: "",
        accountNumber: "",
        certifications: [],
      },
      workflow: {
        currentNode: "finance",
        history: [
          { node: "start", at: daysAgo(2, 14), action: "started", actor: "Jordan Lee" },
          { node: "procurement", at: daysAgo(1, 15), action: "approved", actor: "Alex Rivera" },
        ],
      },
    }),
    base({
      id: "sub_norte",
      formVersion: 3,
      createdAt: daysAgo(6, 12),
      updatedAt: daysAgo(5, 16),
      status: "approved",
      data: {
        supplierType: "colombian_company",
        legalName: "Norte Frio SAS",
        country: "CO",
        nit: "901220331-8",
        address: { line1: "Calle 100 # 19-61", city: "Bogotá", region: "DC", postalCode: "110111", country: "CO" },
        repName: "Mateo Ruiz",
        repEmail: "mateo@nortefrio.example",
        paymentMethod: "transfer",
        bankName: "Davivienda",
        accountNumber: "002-119933",
        certifications: [],
      },
      workflow: {
        currentNode: "done",
        history: [
          { node: "start", at: daysAgo(6, 12), action: "started", actor: "Mateo Ruiz" },
          { node: "procurement", at: daysAgo(6, 15), action: "approved", actor: "Alex Rivera" },
          { node: "finance", at: daysAgo(5, 16), action: "approved", actor: "Alex Rivera" },
          { node: "pdf", at: daysAgo(5, 16), action: "pdf-generated", actor: "Meridian" },
          { node: "archive", at: daysAgo(5, 16), action: "archived", actor: "Meridian" },
        ],
      },
    }),
    base({
      id: "sub_rejected",
      formVersion: 2,
      createdAt: daysAgo(9),
      updatedAt: daysAgo(8),
      status: "rejected",
      data: { supplierType: "foreign", legalName: "Untitled Co", country: "MX", taxId: "XAXX010101000", repEmail: "no@example.com", paymentMethod: "transfer" },
      workflow: {
        currentNode: "rejected",
        history: [
          { node: "start", at: daysAgo(9), action: "started", actor: "Guest" },
          { node: "procurement", at: daysAgo(8), action: "rejected", actor: "Alex Rivera", note: "Legal name is not a registered entity" },
        ],
      },
    }),
  ];

  return {
    workspaceName: "Northwind Procurement",
    actorName: "Alex Rivera",
    forms: [supplier, incident],
    submissions,
    idempotency: [],
  };
}

export const useFormStore = create<FormState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      createOpen: false,
      serverRevision: 0,
      palette: [],
      role: "owner",
      connections: [LOCAL_CONNECTION],
      audit: [],
      webhooks: [],
      ...seed(),
      setHydrated: (hydrated) => set({ hydrated }),
      setCreateOpen: (createOpen) => set({ createOpen }),
      setActorName: (actorName) => set({ actorName }),
      setWorkspaceName: (workspaceName) => set({ workspaceName }),
      setRole: (role) => set({ role, audit: [{ id: uid("aud"), at: new Date().toISOString(), actor: get().actorName, action: "role.changed", target: role }, ...get().audit].slice(0, 200) }),
      setPalette: (palette) => set({ palette }),
      upsertConnection: (connection) => {
        if (!can(get().role, "storage.manage")) return;
        const rest = get().connections.filter((item) => item.id !== connection.id);
        set({ connections: [connection, ...rest] });
      },
      removeConnection: (id) => {
        if (!can(get().role, "storage.manage") || id === "conn_local") return;
        set({ connections: get().connections.filter((item) => item.id !== id) });
      },
      upsertWebhook: (hook) => {
        if (!can(get().role, "integration.manage")) return;
        const rest = get().webhooks.filter((item) => item.id !== hook.id);
        set({ webhooks: [hook, ...rest] });
      },
      removeWebhook: (id) => {
        if (!can(get().role, "integration.manage")) return;
        set({ webhooks: get().webhooks.filter((item) => item.id !== id) });
      },
      addForm: (form) => {
        if (!can(get().role, "form.create")) return;
        set({
          forms: [form, ...get().forms],
          audit: [{ id: uid("aud"), at: new Date().toISOString(), actor: get().actorName, action: "form.created", target: form.id, detail: form.title }, ...get().audit].slice(0, 200),
        });
      },
      updateForm: (id, recipe, message) => {
        if (!can(get().role, "form.edit")) return;
        set({
          forms: get().forms.map((form) => {
            if (form.id !== id) return form;
            const next = recipe(form);
            const activity = message
              ? [{ at: new Date().toISOString(), actor: get().actorName, message }, ...next.activity].slice(0, 40)
              : next.activity;
            return { ...next, activity, updatedAt: new Date().toISOString(), hasUnpublishedChanges: true };
          }),
        });
      },
      publishForm: (id, note) => {
        if (!can(get().role, "form.publish")) return { ok: false, issues: [{ level: "error", code: "FORBIDDEN", message: "This role cannot publish forms" }] };
        const form = get().forms.find((item) => item.id === id);
        if (!form) return { ok: false, issues: [{ level: "error", code: "MISSING", message: "Form not found" }] };
        const issues = lintForm(form);
        if (lintBlocksPublish(issues)) return { ok: false, issues };
        if (form.status === "published" && !form.hasUnpublishedChanges) return { ok: true, issues };
        const version = form.versions.length === 0 ? 1 : form.version + 1;
        const snapshot: FormVersion = {
          version,
          savedAt: new Date().toISOString(),
          note: note || "Published",
          title: form.title,
          display: form.display,
          components: form.components,
          workflow: form.workflow,
        };
        set({
          forms: get().forms.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "published",
                  version,
                  hasUnpublishedChanges: false,
                  publishedAt: snapshot.savedAt,
                  versions: [...item.versions.filter((v) => v.version !== version), snapshot],
                  updatedAt: snapshot.savedAt,
                  activity: [{ at: snapshot.savedAt, actor: get().actorName, message: `Published version ${version}` }, ...item.activity].slice(0, 40),
                }
              : item,
          ),
        });
        return { ok: true, issues };
      },
      restoreVersion: (id, version) => {
        const form = get().forms.find((item) => item.id === id);
        const snapshot = form?.versions.find((item) => item.version === version);
        if (!form || !snapshot) return;
        get().updateForm(
          id,
          (current) => ({
            ...current,
            title: snapshot.title,
            display: snapshot.display,
            components: snapshot.components,
            workflow: snapshot.workflow,
          }),
          `Restored version ${version} as a draft`,
        );
      },
      duplicateForm: (id) => {
        const form = get().forms.find((item) => item.id === id);
        if (!form) return null;
        const copy: FormDefinition = {
          ...structuredClone(form),
          id: uid("frm"),
          name: `${form.name}Copy`,
          title: `${form.title} copy`,
          status: "draft",
          version: 1,
          hasUnpublishedChanges: true,
          versions: [],
          publishedAt: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activity: [{ at: new Date().toISOString(), actor: get().actorName, message: `Cloned from ${form.title}` }],
        };
        get().addForm(copy);
        return copy.id;
      },
      setStatus: (id, status) =>
        set({
          forms: get().forms.map((form) =>
            form.id === id ? { ...form, status, updatedAt: new Date().toISOString() } : form,
          ),
        }),
      submit: async (input) => {
        if (!can(get().role, "submission.create") && input.source !== "agent") {
          return { ok: false, code: "FORBIDDEN", message: "This role cannot submit" };
        }
        if (input.source === "agent" && !can(get().role, "submission.create") && get().role !== "agent" && get().role !== "owner") {
          return { ok: false, code: "FORBIDDEN", message: "This role cannot submit as an agent" };
        }
        if (input.source === "agent" && !allowAgent()) {
          return { ok: false, code: "RATE_LIMITED", message: "Too many agent submissions this minute. Try again shortly." };
        }
        const form = get().forms.find((item) => item.id === input.formId);
        if (!form) return { ok: false, code: "NOT_FOUND", message: "Form not found" };
        if (form.status === "archived") return { ok: false, code: "ARCHIVED", message: "This form is archived" };
        const hash = JSON.stringify(input.data);
        if (input.idempotencyKey) {
          const prior = get().idempotency.find((item) => item.key === input.idempotencyKey);
          if (prior && prior.hash !== hash) {
            return { ok: false, code: "IDEMPOTENCY_CONFLICT", message: "This idempotency key was already used with a different payload" };
          }
          if (prior) {
            const existing = get().submissions.find((item) => item.id === prior.submissionId);
            if (existing) return { ok: true, submission: existing };
          }
        }
        if (!input.draft) {
          const errors = validateForm(form, input.data);
          if (Object.keys(errors).length > 0) {
            return { ok: false, code: "FORM_VALIDATION_FAILED", message: "Submission contains invalid fields", errors };
          }
        }
        const settled = input.draft ? { ok: true as const, data: input.data } : settleCaptcha(form.components, input.data);
        if (!settled.ok) {
          return { ok: false, code: "FORM_VALIDATION_FAILED", message: "Submission contains invalid fields", errors: settled.errors };
        }
        const payload = settled.data;
        const now = new Date().toISOString();
        const existing = input.existingId ? get().submissions.find((item) => item.id === input.existingId) : undefined;
        let submission: Submission = existing
          ? {
              ...existing,
              data: payload,
              updatedAt: now,
              status: input.draft ? "draft" : existing.status === "changes_requested" ? "in_review" : existing.status,
              revisions: [...existing.revisions, { at: now, actor: input.actor, note: input.draft ? "Draft saved" : "Updated", data: existing.data }],
            }
          : {
              id: uid("sub"),
              formId: form.id,
              formName: form.name,
              formVersion: form.version,
              createdAt: now,
              updatedAt: now,
              status: input.draft ? "draft" : form.workflow ? "in_review" : "submitted",
              data: payload,
              revisions: [],
              documents: [],
              workflow: input.draft ? undefined : startWorkflow(form, input.actor),
              idempotencyKey: input.idempotencyKey,
            };
        if (!input.draft) {
          rememberConnections(get().connections ?? []);
          submission = await advanceServices(form, submission, "Meridian");
        }
        set({
          submissions: existing ? get().submissions.map((item) => (item.id === existing.id ? submission : item)) : [submission, ...get().submissions],
          idempotency: input.idempotencyKey
            ? [...get().idempotency.filter((item) => item.key !== input.idempotencyKey), { key: input.idempotencyKey, hash, submissionId: submission.id, at: now }]
            : get().idempotency,
        });
        fanout(get().webhooks, input.draft ? "submission.updated" : "submission.created", { id: submission.id, form: form.name, status: submission.status });
        return { ok: true, submission };
      },
      workflowAction: async (submissionId, action, note) => {
        if (!can(get().role, "workflow.approve")) return { ok: false, message: "This role cannot act on workflow tasks" };
        const current = get().submissions.find((item) => item.id === submissionId);
        const form = current ? get().forms.find((item) => item.id === current.formId) : undefined;
        if (!current || !form || !current.workflow || !form.workflow) return { ok: false, message: "This record is not in a workflow" };
        const actor = get().actorName;
        const now = new Date().toISOString();
        if (action === "changes") {
          const next: Submission = {
            ...current,
            status: "changes_requested",
            updatedAt: now,
            workflow: {
              ...current.workflow,
              history: [...current.workflow.history, { node: current.workflow.currentNode, at: now, action: "changes-requested", actor, note }],
            },
          };
          set({ submissions: get().submissions.map((item) => (item.id === submissionId ? next : item)) });
          return { ok: true };
        }
        const workflow = applyHumanAction(form, current.workflow, action === "approve" ? "approve" : "reject", actor, note, now);
        let next: Submission = { ...current, updatedAt: now, workflow };
        if (action === "reject" && workflow.currentNode === current.workflow.currentNode && !(workflow.tokens?.length)) {
          next.status = "rejected";
        }
        const landedEarly = form.workflow.nodes.find((node) => node.id === workflow.currentNode);
        if (action === "reject" && (landedEarly?.type === "end" || /reject/i.test(landedEarly?.title ?? ""))) next.status = "rejected";
        rememberConnections(get().connections ?? []);
        next = await advanceServices(form, next, "Meridian");
        set({
          submissions: get().submissions.map((item) => (item.id === submissionId ? next : item)),
          audit: [{ id: uid("aud"), at: now, actor, action: `workflow.${action}`, target: submissionId, detail: note }, ...get().audit].slice(0, 200),
        });
        const failed = next.workflow?.history.at(-1)?.action === "storage-failed";
        return failed ? { ok: false, message: next.workflow?.history.at(-1)?.note } : { ok: true };
      },
      removeSubmission: (id) => {
        if (!can(get().role, "submission.delete")) return;
        set({ submissions: get().submissions.filter((item) => item.id !== id) });
      },
    }),
    {
      name: "meridian-studio-v1",
      skipHydration: true,
      partialize: (state) => ({
        workspaceName: state.workspaceName,
        actorName: state.actorName,
        forms: state.forms,
        submissions: state.submissions,
        idempotency: state.idempotency,
        role: state.role,
        connections: state.connections,
        audit: state.audit,
        webhooks: state.webhooks,
        serverRevision: state.serverRevision,
      }),
    },
  ),
);
