import type { FormioSetting } from "./adapter.ts";

export type ParityStatus = "FULL" | "PARTIAL" | "MISSING" | "NOT_APPLICABLE" | "INTENTIONALLY_UNSUPPORTED";

export interface ParityDecision {
  status: ParityStatus;
  reason: string;
  ui: ParityStatus;
  persistence: ParityStatus;
  runtime: ParityStatus;
}

const RUNTIME_FULL = new Set([
  "label",
  "labelPosition",
  "hideLabel",
  "placeholder",
  "description",
  "tooltip",
  "prefix",
  "suffix",
  "customClass",
  "hidden",
  "disabled",
  "tableView",
  "persistent",
  "protected",
  "spellcheck",
  "autocomplete",
  "tabindex",
  "autofocus",
  "multiple",
  "defaultValue",
  "clearOnHide",
  "validate.required",
  "validate.minLength",
  "validate.maxLength",
  "validate.min",
  "validate.max",
  "validate.minWords",
  "validate.maxWords",
  "validate.pattern",
  "validate.customMessage",
  "errorLabel",
  "inputMask",
  "showWordCount",
  "showCharCount",
  "rows",
  "data.values",
  "values",
  "conditional.show",
  "conditional.when",
  "conditional.eq",
  "conditional.json",
  "key",
  "currency",
  "case",
  "truncateMultipleSpaces",
  "attributes",
  "filePattern",
  "fileMaxSize",
  "fileMinSize",
  "fileTypes",
  "questions",
  "html",
  "content",
  "tag",
  "action",
  "footer",
  "width",
  "height",
  "backgroundColor",
  "penColor",
  "inline",
  "dataSrc",
  "data.json",
  "data.url",
  "selectValues",
  "valueProperty",
]);

function decision(status: ParityStatus, reason: string, runtime: ParityStatus = status): ParityDecision {
  return { status, reason, ui: status === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "FULL", persistence: status === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "FULL", runtime };
}

export function classifySetting(componentType: string, setting: Pick<FormioSetting, "key" | "editorType" | "ignored" | "help" | "editor">): ParityDecision {
  if (setting.ignored) {
    return decision("NOT_APPLICABLE", "Upstream edit form sets ignore:true, so the inherited control is not part of this component.");
  }
  if (setting.help || !setting.key || setting.editorType === "button" || setting.editorType === "html") {
    return decision("NOT_APPLICABLE", "Edit-form help or action, not a stored component property.");
  }
  if (componentType === "recaptcha") {
    return decision(
      "PARTIAL",
      "The palette runs Meridian's own character check. Google reCAPTCHA, hCaptcha, and Turnstile are not called and no third-party secret is sent.",
      "PARTIAL",
    );
  }
  if (setting.key === "customConditional" || setting.key === "validate.custom" || setting.key === "validate.customPrivate" || setting.key === "customDefaultValue") {
    return decision(
      "INTENTIONALLY_UNSUPPORTED",
      "Arbitrary JavaScript is stored on the component and shown in the inspector. Strict mode does not execute it.",
      "INTENTIONALLY_UNSUPPORTED",
    );
  }
  if (setting.key === "calculateValue") {
    return decision(
      "PARTIAL",
      "Safe expressions run. JavaScript assignments (value =, data., return) are stored and are not executed.",
      "PARTIAL",
    );
  }
  if (setting.key === "logic") {
    return decision("PARTIAL", "Logic rules are stored and edited. Custom JavaScript actions are not executed.", "PARTIAL");
  }
  if (componentType === "form" && (setting.key === "form" || setting.key === "src" || setting.key === "reference")) {
    return decision("PARTIAL", "Nested Form schema is stored. Form.io resource loading is not available; use a container for nested fields.", "PARTIAL");
  }
  if (["data.resource", "data.headers", "authenticate", "indexeddb.database", "indexeddb.table", "indexeddb.filter", "data.custom", "lazyLoad", "ignoreCache", "refreshOn", "searchField", "filter", "sort", "limit"].includes(setting.key)) {
    return decision(
      "PARTIAL",
      "The setting is stored and exported. Resource, IndexedDB, and authenticated Form.io fetches are not executed. Static values, raw JSON, and plain http(s) URLs are.",
      "PARTIAL",
    );
  }
  if (setting.key === "encrypted") {
    return decision("PARTIAL", "The flag is stored and submission previews omit the value. This build does not apply a separate per-field cipher.", "PARTIAL");
  }
  if (setting.key === "dbIndex" || setting.key === "unique") {
    return decision("PARTIAL", "Stored on the component. A database unique index is not created automatically for the field.", "PARTIAL");
  }
  if (setting.key === "redrawOn" || setting.key === "calculateServer") {
    return decision("PARTIAL", "Stored. Calculations run in the browser on change; there is no separate server calculate pass.", "PARTIAL");
  }
  if (setting.key.startsWith("overlay.")) {
    return decision("PARTIAL", "Stored. Numeric page and box values are copied onto the Meridian PDF placement when they are numbers.", "PARTIAL");
  }
  if (RUNTIME_FULL.has(setting.key)) {
    return decision("FULL", "Shown in the inspector, stored on the component document, and applied by the native renderer or export.");
  }
  return decision(
    "PARTIAL",
    "Shown in the inspector and stored losslessly for import and export. The native renderer does not special-case this property.",
    "PARTIAL",
  );
}
