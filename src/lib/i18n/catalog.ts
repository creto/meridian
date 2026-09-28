export const LOCALES = ["en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

const en = {
  "validation.required": "{{label}} is required",
  "validation.email": "Enter a valid email address",
  "validation.min": "Enter at least {{min}}",
  "validation.max": "Enter at most {{max}}",
  "validation.pattern": "{{label}} does not match the required pattern",
  "validation.fileType": "This file type is not allowed",
  "validation.fileSize": "File must be {{max}} or smaller",
  "action.submit": "Submit",
  "action.saveDraft": "Save draft",
  "action.next": "Next",
  "action.back": "Back",
  "action.cancel": "Cancel",
  "action.delete": "Delete",
  "workflow.approved": "Approved",
  "workflow.rejected": "Rejected",
  "workflow.changes": "{{actor}} requested changes",
  "status.draft": "Draft",
  "status.submitted": "Submitted",
  "status.in_review": "In review",
  "status.approved": "Approved",
  "status.rejected": "Rejected",
  "status.deleted": "Deleted",
  "field.textfield": "Text",
  "field.textarea": "Long text",
  "field.number": "Number",
  "field.email": "Email",
  "field.phone": "Phone",
  "field.url": "URL",
  "field.password": "Password",
  "field.select": "Select",
  "field.radio": "Radio",
  "field.checkbox": "Checkbox",
  "field.date": "Date",
  "field.datetime": "Date and time",
  "field.time": "Time",
  "field.currency": "Currency",
  "field.file": "File",
  "field.signature": "Signature",
  "field.address": "Address",
  "admin.users": "Users",
  "admin.roles": "Roles",
  "admin.audit": "Audit log",
  "admin.retention": "Retention",
  "admin.settings": "Settings",
  "admin.workspaces": "Workspaces",
  "form.untitled": "Untitled form",
  "error.generic": "Something went wrong. Try again.",
} as const;

export type MessageKey = keyof typeof en;

const es: { [K in MessageKey]: string } = {
  "validation.required": "{{label}} es obligatorio",
  "validation.email": "Introduce un correo electrónico válido",
  "validation.min": "Introduce al menos {{min}}",
  "validation.max": "Introduce como máximo {{max}}",
  "validation.pattern": "{{label}} no coincide con el formato requerido",
  "validation.fileType": "Este tipo de archivo no está permitido",
  "validation.fileSize": "El archivo debe pesar {{max}} o menos",
  "action.submit": "Enviar",
  "action.saveDraft": "Guardar borrador",
  "action.next": "Siguiente",
  "action.back": "Atrás",
  "action.cancel": "Cancelar",
  "action.delete": "Eliminar",
  "workflow.approved": "Aprobado",
  "workflow.rejected": "Rechazado",
  "workflow.changes": "{{actor}} solicitó cambios",
  "status.draft": "Borrador",
  "status.submitted": "Enviado",
  "status.in_review": "En revisión",
  "status.approved": "Aprobado",
  "status.rejected": "Rechazado",
  "status.deleted": "Eliminado",
  "field.textfield": "Texto",
  "field.textarea": "Texto largo",
  "field.number": "Número",
  "field.email": "Correo",
  "field.phone": "Teléfono",
  "field.url": "URL",
  "field.password": "Contraseña",
  "field.select": "Selección",
  "field.radio": "Opción única",
  "field.checkbox": "Casilla",
  "field.date": "Fecha",
  "field.datetime": "Fecha y hora",
  "field.time": "Hora",
  "field.currency": "Moneda",
  "field.file": "Archivo",
  "field.signature": "Firma",
  "field.address": "Dirección",
  "admin.users": "Usuarios",
  "admin.roles": "Roles",
  "admin.audit": "Auditoría",
  "admin.retention": "Retención",
  "admin.settings": "Ajustes",
  "admin.workspaces": "Espacios de trabajo",
  "form.untitled": "Formulario sin título",
  "error.generic": "No se pudo completar la acción. Inténtalo de nuevo.",
};

export const messages: Record<Locale, { [K in MessageKey]: string }> = { en, es };

function isLocale(locale: string): locale is Locale {
  return locale === "en" || locale === "es";
}

/** Build entities without embedding raw `&...;` sequences in source. */
function htmlEscape(value: string): string {
  const amp = String.fromCharCode(38);
  return value
    .replaceAll(amp, amp + "amp;")
    .replaceAll("<", amp + "lt;")
    .replaceAll(">", amp + "gt;")
    .replaceAll('"', amp + "quot;")
    .replaceAll("'", amp + "#39;");
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return match;
    return htmlEscape(String(vars[name]));
  });
}

export function translate(locale: string, key: string, vars?: Record<string, string | number>): string {
  const table = isLocale(locale) ? messages[locale] : messages.en;
  const template = (isLocale(locale) ? table[key as MessageKey] : messages.en[key as MessageKey]) ?? key;
  if (!vars) return template;
  return interpolate(template, vars);
}

function intlLocale(locale: string): string {
  const lower = locale.toLowerCase();
  if (lower === "en" || lower.startsWith("en-") || lower === "es" || lower.startsWith("es-")) return locale;
  return "en";
}

export function formatNumber(locale: string, value: number, digits?: number): string {
  const options: Intl.NumberFormatOptions = {};
  if (digits != null) {
    options.minimumFractionDigits = digits;
    options.maximumFractionDigits = digits;
  }
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatDate(locale: string, iso: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatCurrency(locale: string, amount: number, currency: string): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency }).format(amount);
}

/** English and Spanish both use one vs other for cardinals in this product. */
export function plural(locale: string, count: number, forms: { one: string; other: string }): string {
  const category = new Intl.PluralRules(intlLocale(locale)).select(count);
  const template = category === "one" ? forms.one : forms.other;
  return interpolate(template, { count });
}
