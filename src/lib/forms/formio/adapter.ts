import inventoryJson from "./inventory.generated.json" with { type: "json" };
import type { FormComponent } from "../types.ts";

export interface FormioOption {
  label: string;
  value: string;
}

export interface FormioSetting {
  key: string;
  label?: string;
  tab: string;
  editorType: string;
  weight?: number;
  tooltip?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FormioOption[];
  multiple?: boolean;
  conditional?: unknown;
  customConditional?: string;
  rows?: number;
  editor?: string;
  ignored?: boolean;
  help?: boolean;
  itemFields?: FormioSetting[];
}

export interface FormioComponentInventory {
  type: string;
  title: string;
  group: string;
  icon?: string;
  weight?: number;
  documentation?: string;
  tabOrder: string[];
  defaultSchema: Record<string, unknown>;
  tabs: Record<string, FormioSetting[]>;
  effectivePropertyCount: number;
}

export interface FormioInventory {
  package: string;
  version: string;
  license: string;
  integrity: string;
  repository: string;
  extractedAt: string;
  bases: string[];
  components: Record<string, FormioComponentInventory>;
}

export const FORMIO_INVENTORY = inventoryJson as FormioInventory;

export const MERIDIAN_FORMIO_TYPE: Record<string, string> = {
  textfield: "textfield",
  textarea: "textarea",
  number: "number",
  password: "password",
  email: "email",
  phone: "phoneNumber",
  url: "url",
  hidden: "hidden",
  select: "select",
  radio: "radio",
  checkbox: "checkbox",
  selectboxes: "selectboxes",
  toggle: "checkbox",
  datetime: "datetime",
  date: "day",
  time: "time",
  currency: "currency",
  slider: "number",
  rating: "number",
  content: "content",
  panel: "panel",
  columns: "columns",
  fieldset: "fieldset",
  tabs: "tabs",
  datagrid: "datagrid",
  container: "container",
  file: "file",
  signature: "signature",
  address: "address",
  captcha: "recaptcha",
  button: "button",
  review: "content",
};

const TAB_LABELS: Record<string, string> = {
  display: "Display",
  data: "Data",
  validation: "Validation",
  api: "API",
  conditional: "Conditional",
  logic: "Logic",
  layout: "Layout",
  file: "File",
  provider: "Provider",
  date: "Date",
  time: "Time",
  day: "Day",
  month: "Month",
  year: "Year",
  templates: "Templates",
  form: "Form",
};

export function tabLabel(key: string): string {
  return TAB_LABELS[key] ?? key.slice(0, 1).toUpperCase() + key.slice(1);
}

export function registeredFormioTypes(): string[] {
  return Object.keys(FORMIO_INVENTORY.components);
}

export function componentInventory(type: string): FormioComponentInventory | undefined {
  return FORMIO_INVENTORY.components[type];
}

export function upstreamType(component: Pick<FormComponent, "type" | "formio">): string {
  const declared = component.formio && typeof component.formio.type === "string" ? component.formio.type : "";
  if (declared && FORMIO_INVENTORY.components[declared]) return declared;
  return MERIDIAN_FORMIO_TYPE[component.type] ?? component.type;
}

export function defaultSchema(type: string): Record<string, unknown> {
  const schema = componentInventory(type)?.defaultSchema;
  return schema ? structuredClone(schema) : { type };
}

export function tabsFor(type: string): { key: string; label: string; settings: FormioSetting[] }[] {
  const item = componentInventory(type);
  if (!item) return [];
  return item.tabOrder.map((key) => ({
    key,
    label: tabLabel(key),
    settings: item.tabs[key] ?? [],
  }));
}

export function settingsFor(type: string): FormioSetting[] {
  return tabsFor(type).flatMap((tab) => tab.settings);
}

export function applicableSettings(type: string): FormioSetting[] {
  return settingsFor(type).filter((setting) => setting.key && !setting.ignored && !setting.help && setting.editorType !== "button");
}

const BASIC_KEYS = new Set([
  "label",
  "labelPosition",
  "placeholder",
  "description",
  "tooltip",
  "prefix",
  "suffix",
  "hidden",
  "hideLabel",
  "disabled",
  "validate.required",
  "required",
  "key",
  "defaultValue",
  "data.values",
  "values",
  "multiple",
  "validate.min",
  "validate.max",
  "validate.minLength",
  "validate.maxLength",
  "validate.pattern",
  "conditional.show",
  "conditional.when",
  "conditional.eq",
  "clearOnHide",
  "inputMask",
  "rows",
  "action",
  "html",
  "content",
  "questions",
  "filePattern",
  "fileMaxSize",
  "currency",
]);

export type SettingFilter = "basic" | "advanced" | "all";

export function filterSettings(settings: FormioSetting[], filter: SettingFilter, query: string): FormioSetting[] {
  const needle = query.trim().toLowerCase();
  return settings.filter((setting) => {
    if (setting.ignored || setting.help || !setting.key || setting.editorType === "button") return false;
    if (filter === "basic" && !BASIC_KEYS.has(setting.key)) return false;
    if (filter === "advanced" && BASIC_KEYS.has(setting.key)) return false;
    if (!needle) return true;
    const hay = `${setting.label ?? ""} ${setting.key} ${setting.tooltip ?? ""} ${setting.tab}`.toLowerCase();
    return hay.includes(needle);
  });
}

export function propertyGuide(): string {
  return registeredFormioTypes()
    .map((type) => {
      const keys = [...new Set(applicableSettings(type).map((setting) => setting.key))];
      return `${type}: ${keys.join(", ")}`;
    })
    .join("\n");
}
