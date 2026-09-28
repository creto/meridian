import { uid } from "./ids.ts";
import { newFormShell } from "./importing.ts";
import type { FormComponent, FormDefinition, WorkflowDef } from "./types.ts";

function field(partial: FormComponent): FormComponent {
  return partial;
}

function panel(key: string, label: string, components: FormComponent[]): FormComponent {
  return { id: uid("cmp"), type: "panel", key, label, components };
}

const supplierFlow: WorkflowDef = {
  nodes: [
    { id: "start", type: "start", title: "Submitted" },
    { id: "procurement", type: "human", title: "Procurement review", role: "Procurement" },
    { id: "finance", type: "human", title: "Finance approval", role: "Finance" },
    { id: "pdf", type: "service", title: "Generate PDF", service: "pdf" },
    { id: "archive", type: "service", title: "Store in archive", service: "archive" },
    { id: "done", type: "end", title: "Approved" },
    { id: "rejected", type: "end", title: "Rejected" },
  ],
  edges: [
    { from: "start", to: "procurement", when: "approved" },
    { from: "procurement", to: "finance", when: "approved" },
    { from: "procurement", to: "rejected", when: "rejected" },
    { from: "finance", to: "pdf", when: "approved" },
    { from: "finance", to: "rejected", when: "rejected" },
    { from: "pdf", to: "archive", when: "approved" },
    { from: "archive", to: "done", when: "approved" },
  ],
};

export function supplierForm(): FormDefinition {
  const components: FormComponent[] = [
    panel("organization", "Organization", [
      field({
        id: uid("cmp"),
        type: "radio",
        key: "supplierType",
        label: "Supplier type",
        required: true,
        values: [
          { label: "Colombian company", value: "colombian_company" },
          { label: "Foreign company", value: "foreign" },
        ],
      }),
      field({ id: uid("cmp"), type: "textfield", key: "legalName", label: "Legal name", required: true, semantic: "company-name", placeholder: "Acme SAS" }),
      field({
        id: uid("cmp"),
        type: "select",
        key: "country",
        label: "Country",
        required: true,
        values: [
          { label: "Colombia", value: "CO" },
          { label: "Mexico", value: "MX" },
          { label: "United States", value: "US" },
          { label: "Spain", value: "ES" },
        ],
      }),
      field({
        id: uid("cmp"),
        type: "textfield",
        key: "nit",
        label: "NIT",
        required: true,
        semantic: "identifier",
        classification: "INTERNAL",
        conditional: 'supplierType == "colombian_company"',
        placeholder: "900123456-1",
        validate: { pattern: "^\\d{8,10}(-\\d)?$", patternMessage: "Use 8–10 digits and an optional check digit" },
      }),
      field({
        id: uid("cmp"),
        type: "textfield",
        key: "taxId",
        label: "Tax ID",
        required: true,
        semantic: "identifier",
        classification: "INTERNAL",
        conditional: 'supplierType == "foreign"',
      }),
      field({ id: uid("cmp"), type: "address", key: "address", label: "Address", semantic: "address" }),
    ]),
    panel("representative", "Representative", [
      field({ id: uid("cmp"), type: "textfield", key: "repName", label: "Legal representative", required: true, conditional: 'supplierType == "colombian_company"', semantic: "person-name" }),
      field({ id: uid("cmp"), type: "email", key: "repEmail", label: "Email", required: true }),
      field({ id: uid("cmp"), type: "phone", key: "repPhone", label: "Phone" }),
    ]),
    panel("documents", "Banking and documents", [
      field({
        id: uid("cmp"),
        type: "select",
        key: "paymentMethod",
        label: "Payment method",
        required: true,
        values: [
          { label: "Transfer", value: "transfer" },
          { label: "Check", value: "check" },
        ],
      }),
      field({ id: uid("cmp"), type: "textfield", key: "bankName", label: "Bank", conditional: 'paymentMethod == "transfer"', classification: "CONFIDENTIAL" }),
      field({ id: uid("cmp"), type: "textfield", key: "accountNumber", label: "Account number", conditional: 'paymentMethod == "transfer"', classification: "CONFIDENTIAL", semantic: "financial" }),
      field({ id: uid("cmp"), type: "file", key: "rut", label: "RUT", conditional: 'supplierType == "colombian_company"', semantic: "document" }),
      field({ id: uid("cmp"), type: "file", key: "bankCertificate", label: "Bank certificate", semantic: "document" }),
      field({
        id: uid("cmp"),
        type: "datagrid",
        key: "certifications",
        label: "Certifications",
        components: [
          { id: uid("cmp"), type: "textfield", key: "name", label: "Certification", required: true },
          { id: uid("cmp"), type: "textfield", key: "issuer", label: "Issuer" },
          { id: uid("cmp"), type: "date", key: "expires", label: "Expires" },
        ],
      }),
    ]),
    panel("review", "Review", [
      field({ id: uid("cmp"), type: "review", key: "reviewSummary", label: "Review", description: "Check the registration before it goes to procurement." }),
    ]),
  ];
  return newFormShell({
    id: "frm_supplier",
    name: "supplierRegistration",
    title: "Supplier registration",
    description: "Colombian companies provide NIT, legal representative, and RUT. Foreign companies provide a tax ID. Procurement reviews first, then finance.",
    display: "wizard",
    status: "published",
    version: 3,
    hasUnpublishedChanges: false,
    components,
    workflow: supplierFlow,
    storage: { provider: "workspace-archive", connected: true, pathTemplate: "/suppliers/{{data.nit}}/", note: "Final PDF is written to the workspace archive." },
    tags: ["procurement", "suppliers"],
    source: "template",
    pdfPages: 1,
    settings: {
      submitLabel: "Submit registration",
      draftLabel: "Save draft",
      successMessage: "Registration submitted. Procurement will review it.",
      allowDraft: true,
    },
  });
}

export function incidentForm(): FormDefinition {
  return newFormShell({
    id: "frm_incident",
    name: "incidentReport",
    title: "Incident report",
    description: "Capture what happened, how severe it was, and who saw it.",
    display: "form",
    status: "draft",
    tags: ["operations"],
    components: [
      field({ id: uid("cmp"), type: "content", key: "intro", label: "Note", variant: "alert", description: "Report facts. Do not include passwords or medical detail." }),
      field({ id: uid("cmp"), type: "datetime", key: "occurredAt", label: "When it happened", required: true }),
      field({ id: uid("cmp"), type: "textfield", key: "location", label: "Where", required: true }),
      field({
        id: uid("cmp"),
        type: "radio",
        key: "severity",
        label: "Severity",
        required: true,
        values: [
          { label: "Low", value: "low" },
          { label: "Medium", value: "medium" },
          { label: "High", value: "high" },
        ],
      }),
      field({ id: uid("cmp"), type: "textarea", key: "narrative", label: "What happened", required: true, validate: { minLength: 12, customMessage: "Add a little more detail" } }),
      field({ id: uid("cmp"), type: "textfield", key: "witness", label: "Witness" }),
      field({ id: uid("cmp"), type: "file", key: "photo", label: "Photo" }),
      field({ id: uid("cmp"), type: "toggle", key: "injury", label: "Someone was injured" }),
      field({ id: uid("cmp"), type: "textarea", key: "injuryNote", label: "Injury note", conditional: "injury == true" }),
    ],
  });
}

export function purchaseForm(): FormDefinition {
  return newFormShell({
    title: "Purchase request",
    name: "purchaseRequest",
    description: "Line items calculate their own totals.",
    display: "form",
    tags: ["finance"],
    components: [
      field({ id: uid("cmp"), type: "textfield", key: "requester", label: "Requester", required: true }),
      field({ id: uid("cmp"), type: "date", key: "neededBy", label: "Needed by", required: true }),
      field({
        id: uid("cmp"),
        type: "datagrid",
        key: "lines",
        label: "Lines",
        required: true,
        components: [
          { id: uid("cmp"), type: "textfield", key: "item", label: "Item", required: true },
          { id: uid("cmp"), type: "number", key: "quantity", label: "Qty", required: true, defaultValue: 1 },
          { id: uid("cmp"), type: "currency", key: "unitPrice", label: "Unit price", required: true, currency: "USD" },
          { id: uid("cmp"), type: "currency", key: "lineTotal", label: "Line total", calculateValue: "quantity * unitPrice", currency: "USD" },
        ],
      }),
      field({ id: uid("cmp"), type: "currency", key: "grandTotal", label: "Total", calculateValue: 'SUM(lines, "lineTotal")', currency: "USD" }),
      field({ id: uid("cmp"), type: "textarea", key: "justification", label: "Justification", required: true }),
    ],
    workflow: {
      nodes: [
        { id: "start", type: "start", title: "Submitted" },
        { id: "manager", type: "human", title: "Manager approval", role: "Manager" },
        { id: "done", type: "end", title: "Approved" },
        { id: "rejected", type: "end", title: "Rejected" },
      ],
      edges: [
        { from: "start", to: "manager", when: "approved" },
        { from: "manager", to: "done", when: "approved" },
        { from: "manager", to: "rejected", when: "rejected" },
      ],
    },
  });
}

export function employeeForm(): FormDefinition {
  return newFormShell({
    title: "Employee master",
    name: "employeeMaster",
    description: "Inferred from a typical employee spreadsheet.",
    display: "form",
    tags: ["people"],
    components: [
      field({ id: uid("cmp"), type: "textfield", key: "employeeId", label: "Employee ID", required: true, semantic: "identifier" }),
      field({ id: uid("cmp"), type: "textfield", key: "firstName", label: "First name", required: true }),
      field({ id: uid("cmp"), type: "textfield", key: "lastName", label: "Last name", required: true }),
      field({
        id: uid("cmp"),
        type: "select",
        key: "department",
        label: "Department",
        required: true,
        values: [
          { label: "Engineering", value: "engineering" },
          { label: "Finance", value: "finance" },
          { label: "People", value: "people" },
        ],
      }),
      field({ id: uid("cmp"), type: "email", key: "email", label: "Email", required: true }),
      field({ id: uid("cmp"), type: "date", key: "startDate", label: "Start date", required: true }),
      field({ id: uid("cmp"), type: "currency", key: "salary", label: "Salary", classification: "RESTRICTED", semantic: "financial", currency: "USD" }),
    ],
  });
}

export function surveyForm(): FormDefinition {
  return newFormShell({
    title: "Service survey",
    name: "serviceSurvey",
    description: "A short public survey.",
    display: "wizard",
    tags: ["research"],
    components: [
      panel("about", "About the visit", [
        field({ id: uid("cmp"), type: "rating", key: "score", label: "Overall score", required: true, max: 5 }),
        field({ id: uid("cmp"), type: "radio", key: "channel", label: "How you reached us", values: [
          { label: "Phone", value: "phone" },
          { label: "Web", value: "web" },
          { label: "Office", value: "office" },
        ] }),
      ]),
      panel("comments", "Comments", [
        field({ id: uid("cmp"), type: "textarea", key: "comments", label: "What should change?" }),
        field({ id: uid("cmp"), type: "checkbox", key: "contactOk", label: "You may contact me about this" }),
        field({ id: uid("cmp"), type: "email", key: "email", label: "Email", conditional: "contactOk == true" }),
      ]),
    ],
  });
}

export function supportForm(): FormDefinition {
  return newFormShell({
    title: "Support ticket",
    name: "supportTicket",
    description: "Route a request to the right queue.",
    tags: ["support"],
    components: [
      field({ id: uid("cmp"), type: "textfield", key: "subject", label: "Subject", required: true }),
      field({
        id: uid("cmp"),
        type: "select",
        key: "product",
        label: "Product",
        required: true,
        values: [
          { label: "Billing", value: "billing" },
          { label: "Access", value: "access" },
          { label: "Defect", value: "defect" },
        ],
      }),
      field({ id: uid("cmp"), type: "slider", key: "impact", label: "Impact", min: 1, max: 5, step: 1, defaultValue: 3 }),
      field({ id: uid("cmp"), type: "textarea", key: "details", label: "Details", required: true }),
      field({ id: uid("cmp"), type: "email", key: "replyTo", label: "Reply to", required: true }),
    ],
  });
}

export interface TemplateMeta {
  id: string;
  title: string;
  description: string;
  build: () => FormDefinition;
}

export const TEMPLATES: TemplateMeta[] = [
  { id: "supplier", title: "Supplier onboarding", description: "Wizard, NIT rules, procurement then finance", build: supplierForm },
  { id: "employee", title: "Employee master", description: "Identity, department, start date, salary", build: employeeForm },
  { id: "purchase", title: "Purchase request", description: "Grid formulas and a total", build: purchaseForm },
  { id: "incident", title: "Incident report", description: "Severity and conditional injury note", build: incidentForm },
  { id: "survey", title: "Survey", description: "Two-step rating and comments", build: surveyForm },
  { id: "support", title: "Support ticket", description: "Short request with impact", build: supportForm },
];

export function templateById(id: string): FormDefinition | null {
  const found = TEMPLATES.find((item) => item.id === id);
  if (!found) return null;
  const form = found.build();
  return {
    ...form,
    id: uid("frm"),
    status: "draft",
    version: 1,
    hasUnpublishedChanges: true,
    versions: [],
    publishedAt: undefined,
    activity: [],
  };
}
