import { MERIDIAN_FORMIO_TYPE } from "./formio/adapter.ts";
import { uid } from "./ids.ts";
import type { ComponentType, FormComponent } from "./types.ts";

export interface CatalogItem {
  type: ComponentType;
  /** Upstream Form.io type when it differs from the Meridian renderer family. */
  formioType?: string;
  label: string;
  group: "Basic" | "Choice" | "Dates" | "Numeric" | "Content" | "Layout" | "Data" | "Files" | "Advanced";
  description: string;
  icon: string;
}

export const CATALOG: CatalogItem[] = [
  { type: "textfield", label: "Text", group: "Basic", description: "Single line", icon: "Type" },
  { type: "textarea", label: "Long text", group: "Basic", description: "Multiple lines", icon: "AlignLeft" },
  { type: "number", label: "Number", group: "Basic", description: "Integer or decimal", icon: "Hash" },
  { type: "email", label: "Email", group: "Basic", description: "Email address", icon: "Mail" },
  { type: "phone", label: "Phone", group: "Basic", description: "Telephone", icon: "Phone" },
  { type: "url", label: "URL", group: "Basic", description: "Web address", icon: "Link" },
  { type: "password", label: "Password", group: "Basic", description: "Masked text", icon: "Lock" },
  { type: "hidden", label: "Hidden", group: "Basic", description: "Stored, not shown", icon: "EyeOff" },
  { type: "select", label: "Select", group: "Choice", description: "One option", icon: "ChevronDown" },
  { type: "radio", label: "Radio", group: "Choice", description: "Single choice", icon: "CircleDot" },
  { type: "checkbox", label: "Checkbox", group: "Choice", description: "Yes or no", icon: "CheckSquare" },
  { type: "selectboxes", label: "Checkboxes", group: "Choice", description: "Many options", icon: "ListChecks" },
  { type: "toggle", label: "Toggle", group: "Choice", description: "On or off", icon: "ToggleLeft" },
  { type: "date", label: "Date", group: "Dates", description: "Calendar date", icon: "Calendar" },
  { type: "datetime", label: "Date & time", group: "Dates", description: "Instant", icon: "CalendarClock" },
  { type: "time", label: "Time", group: "Dates", description: "Time of day", icon: "Clock" },
  { type: "currency", label: "Currency", group: "Numeric", description: "Money", icon: "Banknote" },
  { type: "slider", label: "Slider", group: "Numeric", description: "Range", icon: "SlidersHorizontal" },
  { type: "rating", label: "Rating", group: "Numeric", description: "1 to 5", icon: "Star" },
  { type: "content", label: "Content", group: "Content", description: "Heading or note", icon: "TextQuote" },
  { type: "panel", label: "Section", group: "Layout", description: "Grouped fields", icon: "PanelTop" },
  { type: "columns", label: "Columns", group: "Layout", description: "Side by side", icon: "Columns2" },
  { type: "fieldset", label: "Fieldset", group: "Layout", description: "Labeled group", icon: "Square" },
  { type: "tabs", label: "Tabs", group: "Layout", description: "Tabbed groups", icon: "Folder" },
  { type: "datagrid", label: "Grid", group: "Data", description: "Repeating rows", icon: "Table" },
  { type: "container", label: "Group", group: "Data", description: "Nested object", icon: "Braces" },
  { type: "file", label: "File", group: "Files", description: "Upload", icon: "FileUp" },
  { type: "signature", label: "Signature", group: "Files", description: "Draw or type", icon: "PenLine" },
  { type: "address", label: "Address", group: "Advanced", description: "Postal address", icon: "MapPin" },
  { type: "captcha", label: "Captcha", group: "Advanced", description: "Character check", icon: "Shield" },
  { type: "review", label: "Review", group: "Advanced", description: "Summary of answers", icon: "ClipboardCheck" },
  { type: "button", label: "Button", group: "Advanced", description: "Submit action", icon: "MousePointerClick" },
  { type: "radio", formioType: "survey", label: "Survey", group: "Choice", description: "Questions by values", icon: "ListChecks" },
  { type: "textfield", formioType: "tags", label: "Tags", group: "Advanced", description: "Free tags", icon: "Tags" },
  { type: "panel", formioType: "well", label: "Well", group: "Layout", description: "Inset group", icon: "Square" },
  { type: "datagrid", formioType: "datamap", label: "Data map", group: "Data", description: "Key and value rows", icon: "Braces" },
  { type: "datagrid", formioType: "editgrid", label: "Edit grid", group: "Data", description: "Rows open to edit", icon: "Table" },
  { type: "content", formioType: "htmlelement", label: "HTML", group: "Content", description: "Sanitized markup", icon: "Code" },
  { type: "date", formioType: "day", label: "Day", group: "Dates", description: "Month, day, year", icon: "Calendar" },
  { type: "container", formioType: "form", label: "Nested form", group: "Advanced", description: "Embedded fields", icon: "Folder" },
  { type: "captcha", formioType: "recaptcha", label: "reCAPTCHA", group: "Advanced", description: "Uses the built-in check", icon: "Shield" },
];

export const GROUPS = ["Basic", "Choice", "Dates", "Numeric", "Content", "Layout", "Data", "Files", "Advanced"] as const;

function base(type: ComponentType, key: string, label: string, id: string): FormComponent {
  return { id, type, key, label };
}

export function createComponent(type: ComponentType, key: string, id?: string, formioType?: string): FormComponent {
  const resolvedId = id || uid("cmp");
  const item = CATALOG.find((entry) => entry.type === type && entry.formioType === formioType) ?? CATALOG.find((entry) => entry.type === type);
  const label = item?.label ?? type;
  const component = base(type, key, label, resolvedId);
  switch (type) {
    case "select":
    case "radio":
    case "selectboxes":
      component.values = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];
      break;
    case "textarea":
      component.placeholder = "";
      break;
    case "content":
      component.variant = "paragraph";
      component.description = "Add guidance for the person filling this form.";
      component.label = "Note";
      break;
    case "panel":
    case "fieldset":
      component.label = type === "panel" ? "Section" : "Group";
      component.components = [];
      break;
    case "tabs":
      component.label = "Tabs";
      component.components = [
        { id: uid("cmp"), type: "panel", key: `${key}TabA`, label: "Tab A", components: [] },
        { id: uid("cmp"), type: "panel", key: `${key}TabB`, label: "Tab B", components: [] },
      ];
      break;
    case "columns":
      component.label = "Columns";
      component.columns = [
        { width: 6, components: [] },
        { width: 6, components: [] },
      ];
      break;
    case "datagrid":
      component.label = "Rows";
      component.components = [
        { id: uid("cmp"), type: "textfield", key: "name", label: "Name" },
        { id: uid("cmp"), type: "number", key: "quantity", label: "Qty" },
      ];
      break;
    case "container":
      component.label = "Details";
      component.components = [];
      break;
    case "currency":
      component.currency = "USD";
      break;
    case "slider":
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.defaultValue = 40;
      break;
    case "rating":
      component.max = 5;
      break;
    case "checkbox":
    case "toggle":
      component.defaultValue = false;
      break;
    case "hidden":
      component.hidden = true;
      break;
    case "button":
      component.label = "Submit";
      break;
    case "review":
      component.label = "Review";
      component.description = "Confirm the information before submitting.";
      break;
    case "captcha":
      component.label = "Captcha";
      component.required = true;
      component.description = "Type the characters shown. This is checked before the form is accepted.";
      break;
    default:
      break;
  }
  const upstream = formioType ?? MERIDIAN_FORMIO_TYPE[type] ?? type;
  component.formio = { type: upstream };
  if (upstream === "survey") {
    component.formio.questions = [{ label: "How was it?", value: "how" }];
    component.values = component.values ?? [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ];
  }
  if (upstream === "htmlelement") {
    component.formio.tag = "p";
    component.formio.content = component.description ?? "";
  }
  if (upstream === "recaptcha") {
    component.label = "Captcha";
    component.required = true;
    component.description = "Type the characters shown. Google reCAPTCHA is not called; Meridian checks this code.";
    component.formio = { ...component.formio, type: "recaptcha", captchaProvider: "meridian" };
  }
  return component;
}
