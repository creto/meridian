export type ComponentType =
  | "textfield"
  | "textarea"
  | "number"
  | "password"
  | "email"
  | "phone"
  | "url"
  | "hidden"
  | "select"
  | "radio"
  | "checkbox"
  | "selectboxes"
  | "toggle"
  | "datetime"
  | "date"
  | "time"
  | "currency"
  | "slider"
  | "rating"
  | "content"
  | "panel"
  | "columns"
  | "fieldset"
  | "tabs"
  | "datagrid"
  | "container"
  | "file"
  | "signature"
  | "address"
  | "button"
  | "review";

export type Classification = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

export interface OptionItem {
  label: string;
  value: string;
}

export interface ColumnDef {
  width: number;
  components: FormComponent[];
}

export interface ValidateSpec {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  /** Safe expression. Must be truthy. `value` is the field. */
  custom?: string;
  customMessage?: string;
}

export interface PdfPlacement {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FormComponent {
  id: string;
  type: ComponentType;
  key: string;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  defaultValue?: string | number | boolean | null;
  validate?: ValidateSpec;
  /** Safe expression. Field is visible when truthy. */
  conditional?: string;
  /** Safe expression written into the field value. */
  calculateValue?: string;
  values?: OptionItem[];
  components?: FormComponent[];
  columns?: ColumnDef[];
  classification?: Classification;
  semantic?: string;
  variant?: "paragraph" | "heading" | "alert" | "divider";
  currency?: string;
  min?: number;
  max?: number;
  step?: number;
  pdf?: PdfPlacement;
  /** Imported legacy logic that strict mode will not execute. */
  legacyNote?: string;
}

export type WorkflowNodeType = "start" | "human" | "approval" | "decision" | "service" | "http" | "webhook" | "timer" | "parallel" | "join" | "end";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  title: string;
  role?: string;
  service?: "pdf" | "archive" | "storage" | "http" | "webhook";
  /** Absolute URL for http/webhook service nodes. */
  url?: string;
  /** Relative delay before the runner continues. Zero fires immediately. */
  delayMs?: number;
  /** Parallel join policy. Default is all incoming branches. */
  join?: "all" | "any" | "n";
  joinCount?: number;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  /** "approved", "rejected", or a safe expression evaluated against submission data. */
  when?: string;
}

export interface WorkflowDef {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface FormSettings {
  submitLabel: string;
  draftLabel: string;
  successMessage: string;
  allowDraft: boolean;
}

export interface StorageProfile {
  provider: "workspace-archive" | "s3" | "azure-blob" | "gcs" | "minio" | "cmis" | "sharepoint" | "rest";
  /** True only for the local workspace archive, or after a live Test connection succeeded. */
  connected: boolean;
  pathTemplate?: string;
  note?: string;
}

export interface FormStorageTargets {
  attachmentsConnectionId?: string;
  pdfConnectionId?: string;
  archiveConnectionId?: string;
  /** JSON of the submission, separate from the PDF archive. */
  submissionConnectionId?: string;
  pathTemplate?: string;
  attachmentPathTemplate?: string;
  pdfPathTemplate?: string;
}

export interface FormVersion {
  version: number;
  savedAt: string;
  note: string;
  title: string;
  display: "form" | "wizard";
  components: FormComponent[];
  workflow?: WorkflowDef;
}

export interface ActivityEvent {
  at: string;
  actor: string;
  message: string;
}

export interface FormDefinition {
  id: string;
  name: string;
  title: string;
  description: string;
  display: "form" | "wizard";
  status: "draft" | "published" | "archived";
  version: number;
  hasUnpublishedChanges: boolean;
  components: FormComponent[];
  settings: FormSettings;
  workflow?: WorkflowDef;
  storage?: StorageProfile;
  targets?: FormStorageTargets;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  versions: FormVersion[];
  activity: ActivityEvent[];
  pdfPages: number;
  source?: string;
}

export type SubmissionStatus = "draft" | "submitted" | "in_review" | "changes_requested" | "approved" | "rejected";

export interface WorkflowState {
  currentNode: string;
  history: { node: string; at: string; action: string; actor: string; note?: string }[];
  /** ISO time after which a timer node may continue. Persisted with the submission. */
  waitUntil?: string;
  tokens?: { id: string; branchId: string; nodeId: string; status: "active" | "arrived" | "done" | "cancelled" }[];
}

export interface ArchivedDocument {
  id: string;
  filename: string;
  sha256: string;
  bytes: number;
  createdAt: string;
  kind: "filled-pdf" | "attachment";
  provider?: string;
  connectionId?: string;
  path?: string;
  externalId?: string;
  externalUrl?: string;
  version?: string;
  error?: string;
  formVersion?: number;
  pdfTemplateVersion?: number;
  sourcePdfHash?: string;
  generatedPdfHash?: string;
}

export interface Submission {
  id: string;
  formId: string;
  formName: string;
  formVersion: number;
  createdAt: string;
  updatedAt: string;
  status: SubmissionStatus;
  data: Record<string, unknown>;
  revisions: { at: string; actor: string; note: string; data: Record<string, unknown> }[];
  workflow?: WorkflowState;
  documents: ArchivedDocument[];
  idempotencyKey?: string;
}

export interface IdempotencyRecord {
  key: string;
  hash: string;
  submissionId: string;
  at: string;
}

export const LAYOUT_TYPES: ReadonlySet<ComponentType> = new Set([
  "panel",
  "columns",
  "fieldset",
  "tabs",
  "content",
  "button",
  "review",
]);
