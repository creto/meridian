/** Framework-free view models used by the Angular package and the node demo. */

export interface FieldModel {
  key: string;
  type: string;
  label: string;
  required: boolean;
  value: unknown;
  error: string | null;
  visible: boolean;
  options: Array<{ label: string; value: string }>;
}

export interface FormModel {
  id: string;
  title: string;
  mode: "form" | "wizard" | "builder" | "pdf" | "inbox";
  page: number;
  pages: string[];
  fields: FieldModel[];
  message: string | null;
}

export interface ComponentInput {
  id?: string;
  type: string;
  key: string;
  label?: string;
  required?: boolean;
  hidden?: boolean;
  options?: Array<{ label: string; value: string }>;
  components?: ComponentInput[];
  columns?: Array<{ components: ComponentInput[] }>;
}

const INPUTS = new Set(["textfield", "textarea", "number", "password", "email", "phone", "url", "select", "radio", "checkbox", "toggle", "date", "time", "currency", "file", "signature"]);

export function flattenComponents(components: ComponentInput[]): ComponentInput[] {
  const out: ComponentInput[] = [];
  for (const component of components) {
    out.push(component);
    if (component.components) out.push(...flattenComponents(component.components));
    for (const column of component.columns ?? []) out.push(...flattenComponents(column.components));
  }
  return out;
}

export function fieldError(component: ComponentInput, value: unknown): string | null {
  if (component.hidden) return null;
  if (component.required && (value == null || value === "" || value === false)) return `${component.label ?? component.key} is required`;
  if (component.type === "email" && typeof value === "string" && value && !value.includes("@")) return "Enter a valid email";
  if (component.type === "number" && value != null && value !== "" && Number.isNaN(Number(value))) return "Enter a number";
  return null;
}

export function buildFormModel(input: { id: string; title: string; components: ComponentInput[]; data?: Record<string, unknown>; mode?: FormModel["mode"]; page?: number }): FormModel {
  const fields = flattenComponents(input.components).filter((component) => INPUTS.has(component.type)).map((component) => ({
    key: component.key,
    type: component.type,
    label: component.label ?? component.key,
    required: Boolean(component.required),
    value: input.data?.[component.key] ?? "",
    error: fieldError(component, input.data?.[component.key]),
    visible: !component.hidden,
    options: component.options ?? [],
  }));
  return {
    id: input.id,
    title: input.title,
    mode: input.mode ?? "form",
    page: input.page ?? 0,
    pages: ["Details"],
    fields,
    message: fields.some((field) => field.error) ? "Fix the highlighted fields" : null,
  };
}

export class MeridianFormRenderer {
  private readonly form: { id: string; title: string; components: ComponentInput[] };
  constructor(form: { id: string; title: string; components: ComponentInput[] }) {
    this.form = form;
  }
  render(data: Record<string, unknown> = {}): FormModel {
    return buildFormModel({ ...this.form, data });
  }
}

export class MeridianWizard {
  private readonly pages: Array<{ title: string; components: ComponentInput[] }>;
  constructor(pages: Array<{ title: string; components: ComponentInput[] }>) {
    this.pages = pages;
  }
  render(page: number, data: Record<string, unknown>): FormModel {
    const current = this.pages[Math.min(page, this.pages.length - 1)] ?? { title: "Page", components: [] };
    const model = buildFormModel({ id: "wizard", title: current.title, components: current.components, data, mode: "wizard", page });
    model.pages = this.pages.map((item) => item.title);
    return model;
  }
}

export class MeridianSubmissionTable {
  render(rows: Array<Record<string, unknown>>): { columns: string[]; rows: Array<Record<string, unknown>> } {
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return { columns, rows };
  }
}

export class MeridianPdfEditor {
  render(placements: Array<{ key: string; page: number }>): { pages: number; fields: number } {
    const pages = placements.reduce((max, item) => Math.max(max, item.page + 1), 1);
    return { pages, fields: placements.length };
  }
}

export class MeridianWorkflowInbox {
  render(tasks: Array<{ id: string; title: string; status: string }>): Array<{ id: string; title: string; actions: string[] }> {
    return tasks.filter((task) => task.status === "open" || task.status === "claimed").map((task) => ({ id: task.id, title: task.title, status: task.status, actions: ["approve", "reject", "changes"] }));
  }
}

export class MeridianClientService {
  private token: string;
  constructor(privateBase: string, token = "") {
    this.base = privateBase;
    this.token = token;
  }
  private base: string;
  setToken(token: string) { this.token = token; }
  request(path: string, method = "GET", body?: unknown): { url: string; method: string; headers: Record<string, string>; body?: unknown } {
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (body) headers["content-type"] = "application/json";
    return { url: `${this.base}${path}`, method, headers, body };
  }
}

export function MeridianAuthInterceptor(request: { headers: Record<string, string> }, token: string) {
  return { ...request, headers: { ...request.headers, authorization: `Bearer ${token}` } };
}
