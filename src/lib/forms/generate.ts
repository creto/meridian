import { createComponent } from "./catalog.ts";
import { knownProperty, writeSetting } from "./formio/document.ts";
import { uid, uniqueKey } from "./ids.ts";
import { newFormShell } from "./importing.ts";
import type { FormComponent, FormDefinition, WorkflowDef } from "./types.ts";

export interface FieldGuess {
  key: string;
  label: string;
  type: FormComponent["type"];
  required?: boolean;
  conditional?: string;
  description?: string;
  semantic?: string;
  pattern?: string;
  patternMessage?: string;
  values?: { label: string; value: string }[];
  confidence: number;
}

const DICTIONARY: { re: RegExp; guess: Omit<FieldGuess, "confidence"> }[] = [
  { re: /\bnit\b/i, guess: { key: "nit", label: "NIT", type: "textfield", semantic: "identifier", pattern: "^\\d{8,10}(-\\d)?$", patternMessage: "Use a Colombian NIT, for example 900123456-1" } },
  { re: /raz[oó]n social|nombre de la empresa|company name|legal name/i, guess: { key: "legalName", label: "Razón social", type: "textfield", semantic: "company-name", required: true } },
  { re: /tax\s*id|identificaci[oó]n fiscal/i, guess: { key: "taxId", label: "Tax ID", type: "textfield", semantic: "identifier" } },
  { re: /representante legal|legal representative/i, guess: { key: "legalRepresentative", label: "Representante legal", type: "textfield", semantic: "person-name" } },
  { re: /\brut\b/i, guess: { key: "rut", label: "RUT", type: "file", semantic: "document" } },
  { re: /certificado bancario|bank certificate/i, guess: { key: "bankCertificate", label: "Certificado bancario", type: "file", semantic: "document" } },
  { re: /certificaciones?/i, guess: { key: "certifications", label: "Certificaciones", type: "datagrid", semantic: "document" } },
  { re: /direcci[oó]n|address/i, guess: { key: "address", label: "Dirección", type: "address", semantic: "address" } },
  { re: /correo electr[oó]nico|e-?mail/i, guess: { key: "email", label: "Email", type: "email", semantic: "email" } },
  { re: /tel[eé]fono|phone|celular/i, guess: { key: "phone", label: "Teléfono", type: "phone", semantic: "phone" } },
  { re: /datos bancarios|cuenta bancaria|bank account|bank name|banco/i, guess: { key: "bankName", label: "Banco", type: "textfield", semantic: "financial" } },
  { re: /n[uú]mero de cuenta|account number/i, guess: { key: "accountNumber", label: "Número de cuenta", type: "textfield", semantic: "financial" } },
  { re: /fecha de inicio|start date/i, guess: { key: "startDate", label: "Fecha de inicio", type: "date" } },
  { re: /salario|salary|sueldo/i, guess: { key: "salary", label: "Salario", type: "currency", semantic: "financial" } },
  { re: /departamento|department/i, guess: { key: "department", label: "Departamento", type: "select" } },
  { re: /nombre|first name/i, guess: { key: "firstName", label: "Nombre", type: "textfield", semantic: "person-name" } },
  { re: /apellido|last name/i, guess: { key: "lastName", label: "Apellido", type: "textfield", semantic: "person-name" } },
];

function spanish(text: string): boolean {
  return /\b(formulario|necesito|proveedor|razón|razon|dirección|certificado|compras|finanzas|extranjer)\b/i.test(text);
}

function titleFrom(text: string, es: boolean): string {
  const para = text.match(/(?:formulario|form)\s+(?:para|for|de)\s+([^.\n]+)/i);
  if (para?.[1]) {
    const raw = para[1].trim().replace(/\s+/g, " ");
    const short = raw.split(/[,.]| si | if /i)[0]?.trim() ?? raw;
    return short.charAt(0).toUpperCase() + short.slice(1, 80);
  }
  const first = text.split(/[.\n]/)[0]?.trim() ?? "";
  if (first.length > 8 && first.length < 80) return first;
  return es ? "Formulario" : "Untitled form";
}

function supplierTypeField(es: boolean): FieldGuess {
  return {
    key: "supplierType",
    label: es ? "Tipo de proveedor" : "Supplier type",
    type: "radio",
    required: true,
    confidence: 0.96,
    semantic: "generic",
    values: [
      { label: es ? "Empresa colombiana" : "Colombian company", value: "colombian_company" },
      { label: es ? "Extranjera" : "Foreign", value: "foreign" },
    ],
  };
}

export function guessFields(text: string): FieldGuess[] {
  const es = spanish(text);
  const found: FieldGuess[] = [];
  const seen = new Set<string>();
  const push = (guess: FieldGuess) => {
    if (seen.has(guess.key)) return;
    seen.add(guess.key);
    found.push(guess);
  };

  const supplier = /proveedor|supplier|vendor/i.test(text);
  const colombian = /colombian|colombiana/i.test(text);
  const foreign = /extranjer|foreign|tax id/i.test(text);
  if (supplier && (colombian || foreign)) push(supplierTypeField(es));

  for (const entry of DICTIONARY) {
    if (!entry.re.test(text)) continue;
    const guess: FieldGuess = { ...entry.guess, confidence: 0.9 };
    if (guess.key === "nit" && (colombian || foreign)) {
      guess.conditional = 'supplierType == "colombian_company"';
      guess.required = true;
      guess.confidence = 0.98;
    }
    if (guess.key === "taxId" && (foreign || colombian)) {
      guess.conditional = 'supplierType == "foreign"';
      guess.required = true;
      guess.confidence = 0.97;
    }
    if ((guess.key === "rut" || guess.key === "legalRepresentative") && colombian) {
      guess.conditional = 'supplierType == "colombian_company"';
      guess.required = guess.key === "legalRepresentative";
      guess.confidence = 0.93;
    }
    if (guess.key === "legalName") guess.label = es ? "Razón social" : "Legal name";
    push(guess);
  }

  if (/datos bancarios|bank/i.test(text) && !seen.has("accountNumber")) {
    push({ key: "accountNumber", label: es ? "Número de cuenta" : "Account number", type: "textfield", semantic: "financial", confidence: 0.8, conditional: 'paymentMethod == "transfer"' });
  }
  if (/datos bancarios|banco|bank/i.test(text) && !seen.has("paymentMethod")) {
    push({
      key: "paymentMethod",
      label: es ? "Forma de pago" : "Payment method",
      type: "select",
      required: true,
      confidence: 0.86,
      values: [
        { label: es ? "Transferencia" : "Transfer", value: "transfer" },
        { label: es ? "Cheque" : "Check", value: "check" },
      ],
    });
    const bank = found.find((f) => f.key === "bankName");
    if (bank) bank.conditional = 'paymentMethod == "transfer"';
  }

  if (found.length === 0) {
    const chunks = text
      .split(/[\n,;]+/)
      .map((part) => part.replace(/^(and|y|need|necesito|with|con)\s+/i, "").trim())
      .filter((part) => part.length > 1 && part.length < 48);
    for (const chunk of chunks.slice(0, 12)) {
      const key = uniqueKey(chunk, seen);
      const lower = chunk.toLowerCase();
      const type: FormComponent["type"] = /email/.test(lower) ? "email" : /phone|tel/.test(lower) ? "phone" : /date|fecha/.test(lower) ? "date" : /comment|nota|descrip/.test(lower) ? "textarea" : "textfield";
      push({ key, label: chunk.charAt(0).toUpperCase() + chunk.slice(1), type, confidence: 0.62, required: true });
    }
  }
  return found;
}

function toComponent(guess: FieldGuess, taken: Set<string>): FormComponent {
  const key = uniqueKey(guess.key, taken);
  taken.add(key);
  const component = createComponent(guess.type, key, uid("cmp"));
  component.key = key;
  component.label = guess.label;
  component.required = guess.required;
  component.conditional = guess.conditional;
  component.description = guess.description;
  component.semantic = guess.semantic;
  if (guess.values) component.values = guess.values;
  if (guess.pattern) component.validate = { pattern: guess.pattern, patternMessage: guess.patternMessage };
  if (guess.type === "datagrid") {
    component.components = [
      { id: uid("cmp"), type: "textfield", key: "name", label: "Nombre", required: true },
      { id: uid("cmp"), type: "textfield", key: "issuer", label: "Emisor" },
      { id: uid("cmp"), type: "date", key: "expires", label: "Vence" },
    ];
  }
  if (guess.semantic === "financial") component.classification = "CONFIDENTIAL";
  if (guess.semantic === "identifier") component.classification = "INTERNAL";
  return component;
}

function workflowFor(text: string): WorkflowDef | undefined {
  const procurement = /compras|procurement/i.test(text);
  const finance = /finanzas|finance/i.test(text);
  if (!procurement && !finance) return undefined;
  const nodes: WorkflowDef["nodes"] = [{ id: "start", type: "start", title: "Submitted" }];
  const edges: WorkflowDef["edges"] = [];
  let prev = "start";
  if (procurement) {
    nodes.push({ id: "procurement", type: "human", title: "Procurement review", role: "Procurement" });
    edges.push({ from: prev, to: "procurement", when: "approved" });
    prev = "procurement";
  }
  if (finance) {
    nodes.push({ id: "finance", type: "human", title: "Finance approval", role: "Finance" });
    edges.push({ from: prev, to: "finance", when: "approved" });
    prev = "finance";
  }
  if (/pdf/i.test(text)) {
    nodes.push({ id: "pdf", type: "service", title: "Generate PDF", service: "pdf" });
    edges.push({ from: prev, to: "pdf", when: "approved" });
    prev = "pdf";
  }
  if (/ecm|archivo|archive/i.test(text)) {
    nodes.push({ id: "archive", type: "service", title: "Store in archive", service: "archive" });
    edges.push({ from: prev, to: "archive", when: "approved" });
    prev = "archive";
  }
  nodes.push({ id: "done", type: "end", title: "Approved" });
  nodes.push({ id: "rejected", type: "end", title: "Rejected" });
  edges.push({ from: prev, to: "done", when: "approved" });
  const humans = nodes.filter((n) => n.type === "human");
  for (const human of humans) edges.push({ from: human.id, to: "rejected", when: "rejected" });
  return { nodes, edges };
}

export function generateFormFromText(text: string): FormDefinition {
  const es = spanish(text);
  const guesses = guessFields(text);
  const taken = new Set<string>();
  const fields = guesses.map((guess) => toComponent(guess, taken));
  const groups = new Map<string, FormComponent[]>();
  const place = (name: string, component: FormComponent) => {
    const list = groups.get(name) ?? [];
    list.push(component);
    groups.set(name, list);
  };
  for (const field of fields) {
    if (["supplierType", "legalName", "country", "nit", "taxId", "address"].includes(field.key)) place(es ? "Organización" : "Organization", field);
    else if (["legalRepresentative", "email", "phone", "firstName", "lastName"].includes(field.key)) place(es ? "Contacto" : "Contact", field);
    else if (["paymentMethod", "bankName", "accountNumber", "rut", "bankCertificate", "certifications", "salary"].includes(field.key)) place(es ? "Documentos y pago" : "Documents", field);
    else place(es ? "Detalles" : "Details", field);
  }
  const multi = groups.size > 1 || fields.length > 6;
  let components: FormComponent[];
  if (multi) {
    components = [...groups.entries()].map(([label, children], index) => {
      const panel = createComponent("panel", `page${index + 1}`, uid("cmp"));
      panel.label = label;
      panel.key = `page${index + 1}`;
      panel.components = children;
      return panel;
    });
    const review = createComponent("panel", "review", uid("cmp"));
    review.label = es ? "Revisión" : "Review";
    review.components = [createComponent("review", "reviewSummary", uid("cmp"))];
    components.push(review);
  } else components = fields;

  const workflow = workflowFor(text);
  const wantsArchive = /ecm|pdf|archivo/i.test(text);
  return newFormShell({
    title: titleFrom(text, es),
    description: text.trim().slice(0, 280),
    display: multi ? "wizard" : "form",
    components,
    workflow,
    storage: wantsArchive
      ? { provider: "workspace-archive", connected: true, pathTemplate: "/suppliers/{{data.nit}}/", note: "Final PDF is stored in the workspace archive." }
      : undefined,
    tags: es ? ["ai", "es"] : ["ai"],
    source: "natural-language",
    activity: [{ at: new Date().toISOString(), actor: "Meridian", message: "Generated from a description" }],
  });
}

export function normalizeAiComponents(raw: unknown): FormComponent[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as { components?: unknown };
  const list = Array.isArray(record.components) ? record.components : Array.isArray(raw) ? raw : [];
  const taken = new Set<string>();
  const convert = (node: unknown, depth: number): FormComponent | null => {
    if (!node || typeof node !== "object" || depth > 6) return null;
    const src = node as Record<string, unknown>;
    const type = String(src.type ?? "textfield") as FormComponent["type"];
    const allowed = new Set(createComponent("textfield", "x").type ? [] : []);
    void allowed;
    const known: FormComponent["type"][] = ["textfield", "textarea", "number", "password", "email", "phone", "url", "hidden", "select", "radio", "checkbox", "selectboxes", "toggle", "datetime", "date", "time", "currency", "slider", "rating", "content", "panel", "columns", "fieldset", "tabs", "datagrid", "container", "file", "signature", "address", "captcha", "button", "review"];
    const safeType = known.includes(type) ? type : "textfield";
    const label = String(src.label ?? safeType);
    const key = uniqueKey(String(src.key ?? label), taken);
    taken.add(key);
    const component = createComponent(safeType, key, uid("cmp"));
    component.key = key;
    component.label = label.slice(0, 120);
    if (typeof src.description === "string") component.description = src.description.slice(0, 400);
    if (typeof src.placeholder === "string") component.placeholder = src.placeholder.slice(0, 120);
    if (src.required === true) component.required = true;
    if (typeof src.conditional === "string" && src.conditional.length < 300) component.conditional = src.conditional;
    if (typeof src.calculateValue === "string" && src.calculateValue.length < 300) component.calculateValue = src.calculateValue;
    if (Array.isArray(src.values)) {
      const values = src.values.slice(0, 30).map((item) => {
        const opt = item as { label?: string; value?: string };
        return { label: String(opt.label ?? opt.value ?? ""), value: String(opt.value ?? opt.label ?? "") };
      }).filter((opt) => opt.value);
      if (values.length) component.values = values;
    }
    if (src.validate && typeof src.validate === "object") {
      const spec = src.validate as Record<string, unknown>;
      const validate: NonNullable<FormComponent["validate"]> = {};
      if (typeof spec.pattern === "string" && spec.pattern.length < 200) validate.pattern = spec.pattern;
      if (typeof spec.patternMessage === "string") validate.patternMessage = spec.patternMessage.slice(0, 160);
      if (typeof spec.minLength === "number") validate.minLength = spec.minLength;
      if (typeof spec.maxLength === "number") validate.maxLength = spec.maxLength;
      if (Object.keys(validate).length) component.validate = validate;
    }
    if (typeof src.pattern === "string" && src.pattern.length < 200) {
      component.validate = { ...(component.validate ?? {}), pattern: src.pattern, patternMessage: typeof src.patternMessage === "string" ? src.patternMessage.slice(0, 160) : component.validate?.patternMessage };
    }
    if (src.classification === "PUBLIC" || src.classification === "INTERNAL" || src.classification === "CONFIDENTIAL" || src.classification === "RESTRICTED") {
      component.classification = src.classification;
    }
    if (typeof src.semantic === "string") component.semantic = src.semantic.slice(0, 40);
    if (typeof src.currency === "string") component.currency = src.currency.slice(0, 8);
    const extra = src.formio && typeof src.formio === "object" && !Array.isArray(src.formio) ? src.formio as Record<string, unknown> : {};
    let patched = component;
    for (const [path, value] of Object.entries(extra)) {
      if (path === "type" || knownProperty(patched, path)) patched = writeSetting(patched, path, value);
    }
    for (const path of ["inputMask", "prefix", "suffix", "tooltip", "placeholder", "description", "clearOnHide", "multiple"]) {
      if (path in src && knownProperty(patched, path)) patched = writeSetting(patched, path, src[path]);
    }
    if (Array.isArray(src.components)) {
      patched.components = src.components.map((child) => convert(child, depth + 1)).filter((c): c is FormComponent => !!c).slice(0, 40);
    }
    return patched;
  };
  return list.map((node) => convert(node, 0)).filter((c): c is FormComponent => !!c).slice(0, 80);
}
