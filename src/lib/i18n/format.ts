const EN = { save: "Save", publish: "Publish", required: "Required", next: "Next", previous: "Previous" };
const ES = { save: "Guardar", publish: "Publicar", required: "Obligatorio", next: "Siguiente", previous: "Anterior" };

const CATALOGS: Record<string, typeof EN> = { en: EN, es: ES };

export function formMessages(locale: string): typeof EN {
  const language = locale.toLowerCase().split("-")[0] ?? "en";
  return { ...EN, ...(CATALOGS[language] ?? {}) };
}

export function formatDate(value: Date | string, locale: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

export function formatCurrency(value: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}
