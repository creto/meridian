import { createComponent } from "./catalog.ts";
import { compileExpression } from "./expressions.ts";
import { uid, uniqueKey } from "./ids.ts";
import { collectKeys, mapComponents, walkComponents } from "./tree.ts";
import type { FormComponent, FormDefinition } from "./types.ts";

export interface Proposal {
  summary: string[];
  valid: boolean;
  issues: string[];
  apply: (form: FormDefinition) => FormDefinition;
}

function findByMention(components: FormComponent[], mention: string): FormComponent | null {
  const needle = mention.trim().toLowerCase();
  let best: FormComponent | null = null;
  walkComponents(components, ({ component }) => {
    const label = component.label.toLowerCase();
    const key = component.key.toLowerCase();
    if (label === needle || key === needle || label.includes(needle) || needle.includes(label)) best = component;
  });
  return best;
}

function withComponents(form: FormDefinition, components: FormComponent[], message: string): FormDefinition {
  return {
    ...form,
    components,
    hasUnpublishedChanges: true,
    updatedAt: new Date().toISOString(),
    activity: [{ at: new Date().toISOString(), actor: "Assistant", message }, ...form.activity].slice(0, 40),
  };
}

export function proposeEdit(form: FormDefinition, instruction: string): Proposal {
  const text = instruction.trim();
  const lower = text.toLowerCase();
  const issues: string[] = [];

  const optional = text.match(/(?:make|haz|deja|poner)\s+(.+?)\s+(?:optional|opcional)/i);
  const required = text.match(/(?:make|haz)\s+(.+?)\s+(?:required|obligatori[oa])/i);
  const showIf = text.match(/(?:only show|mostrar solo|solo muestra|muestra)\s+(.+?)\s+(?:if|when|si|cuando|for)\s+(.+)/i);
  const add = text.match(/^(?:add|agrega|añade|anade)\s+(?:a |an |un |una )?(.+)/i);
  const wizard = /wizard|pasos|step/i.test(lower);
  const shorter = /shorter|más corto|mas corto|acorta/i.test(lower);
  const bankLast = /bank|banc(?:o|aria|arios).*(last page|última|ultima)|move the bank/i.test(lower);

  if (optional?.[1]) {
    const target = findByMention(form.components, optional[1]);
    if (!target) return { summary: [], valid: false, issues: [`Could not find “${optional[1]}”`], apply: (f) => f };
    return {
      summary: [`${target.label} becomes optional`],
      valid: true,
      issues,
      apply: (current) => withComponents(current, mapComponents(current.components, (c) => (c.id === target.id ? { ...c, required: false } : c)), `${target.label} is now optional`),
    };
  }
  if (required?.[1]) {
    const target = findByMention(form.components, required[1]);
    if (!target) return { summary: [], valid: false, issues: [`Could not find “${required[1]}”`], apply: (f) => f };
    return {
      summary: [`${target.label} becomes required`],
      valid: true,
      issues,
      apply: (current) => withComponents(current, mapComponents(current.components, (c) => (c.id === target.id ? { ...c, required: true } : c)), `${target.label} is now required`),
    };
  }
  if (/bank|cuenta/.test(lower) && /transfer/.test(lower)) {
    return {
      summary: ["Show bank name and account number only when payment is a transfer"],
      valid: true,
      issues,
      apply: (current) =>
        withComponents(
          current,
          mapComponents(current.components, (c) =>
            c.key === "bankName" || c.key === "accountNumber" || /bank|cuenta/i.test(c.label)
              ? { ...c, conditional: 'paymentMethod == "transfer"' }
              : c,
          ),
          "Bank fields depend on payment method",
        ),
    };
  }
  if (showIf?.[1] && showIf[2]) {
    const target = findByMention(form.components, showIf[1]);
    if (!target) return { summary: [], valid: false, issues: [`Could not find “${showIf[1]}”`], apply: (f) => f };
    const clause = showIf[2].replace(/\.$/, "").trim();
    const expr = clause.includes("==") || clause.includes("!=") ? clause : `supplierType == "${clause}"`;
    const compiled = compileExpression(expr.includes("==") ? expr : `${clause}`);
    const conditional = compiled.ok ? expr : expr;
    if (!compileExpression(conditional).ok) issues.push("The visibility rule needs a correction before publish");
    return {
      summary: [`Show ${target.label} only when ${conditional}`],
      valid: compileExpression(conditional).ok,
      issues,
      apply: (current) => withComponents(current, mapComponents(current.components, (c) => (c.id === target.id ? { ...c, conditional } : c)), `Visibility rule on ${target.label}`),
    };
  }
  if (add?.[1] && !wizard) {
    const label = add[1].replace(/[.]+$/, "").trim();
    const lowerLabel = label.toLowerCase();
    const type = /email/.test(lowerLabel) ? "email" : /phone|tel/.test(lowerLabel) ? "phone" : /date|fecha/.test(lowerLabel) ? "date" : /file|document|adjunt/.test(lowerLabel) ? "file" : /section|sección|seccion/.test(lowerLabel) ? "panel" : "textfield";
    const taken = new Set(collectKeys(form.components));
    const key = uniqueKey(label, taken);
    const component = createComponent(type, key, uid("cmp"));
    component.label = label.charAt(0).toUpperCase() + label.slice(1);
    component.key = key;
    if (/colombian nit|nit colomb/i.test(lowerLabel)) {
      component.label = "NIT";
      component.key = uniqueKey("nit", taken);
      component.validate = { pattern: "^\\d{8,10}(-\\d)?$", patternMessage: "Use a Colombian NIT, for example 900123456-1" };
      component.semantic = "identifier";
    }
    return {
      summary: [`Add ${component.label}`],
      valid: true,
      issues,
      apply: (current) => {
        const components = current.components.slice();
        const lastPanel = [...components].reverse().find((c) => c.type === "panel" && c.key !== "review");
        if (current.display === "wizard" && lastPanel) {
          return withComponents(
            current,
            components.map((c) => (c.id === lastPanel.id ? { ...c, components: [...(c.components ?? []), component] } : c)),
            `Added ${component.label}`,
          );
        }
        components.push(component);
        return withComponents(current, components, `Added ${component.label}`);
      },
    };
  }
  if (bankLast) {
    return {
      summary: ["Move bank fields into the last section before review"],
      valid: true,
      issues,
      apply: (current) => {
        const bankKeys = new Set(["bankName", "accountNumber", "paymentMethod", "bankCertificate"]);
        const moved: FormComponent[] = [];
        const strip = (list: FormComponent[]): FormComponent[] =>
          list
            .filter((c) => {
              if (bankKeys.has(c.key)) {
                moved.push(c);
                return false;
              }
              return true;
            })
            .map((c) => ({
              ...c,
              components: c.components ? strip(c.components) : undefined,
              columns: c.columns?.map((col) => ({ ...col, components: strip(col.components) })),
            }));
        const stripped = strip(current.components);
        if (moved.length === 0) return current;
        const pages = stripped.filter((c) => c.type === "panel");
        const target = [...pages].reverse().find((p) => p.key !== "review") ?? pages[pages.length - 1];
        if (!target) return withComponents(current, [...stripped, ...moved], "Moved bank fields");
        return withComponents(
          current,
          stripped.map((c) => (c.id === target.id ? { ...c, components: [...(c.components ?? []), ...moved] } : c)),
          "Moved bank information",
        );
      },
    };
  }
  if (wizard) {
    const steps = Number(text.match(/(\d+)\s*-?\s*step/)?.[1] ?? 3);
    return {
      summary: [`Turn the form into a ${steps}-step wizard`],
      valid: true,
      issues,
      apply: (current) => {
        if (current.display === "wizard" && current.components.every((c) => c.type === "panel")) return current;
        const fields: FormComponent[] = [];
        walkComponents(current.components, ({ component }) => {
          if (!["panel", "columns", "fieldset", "tabs", "content", "button", "review"].includes(component.type)) fields.push({ ...component });
        });
        const size = Math.ceil(fields.length / Math.max(2, steps)) || 1;
        const pages: FormComponent[] = [];
        for (let i = 0; i < Math.max(fields.length, 1); i += size) {
          const panel = createComponent("panel", `page${pages.length + 1}`, uid("cmp"));
          panel.label = `Step ${pages.length + 1}`;
          panel.key = `page${pages.length + 1}`;
          panel.components = fields.slice(i, i + size);
          pages.push(panel);
        }
        return {
          ...withComponents(current, pages, `Converted into a ${pages.length}-step wizard`),
          display: "wizard",
        };
      },
    };
  }
  if (shorter) {
    return {
      summary: ["Remove helper text and make non-identifier fields optional"],
      valid: true,
      issues,
      apply: (current) =>
        withComponents(
          current,
          mapComponents(current.components, (c) => ({
            ...c,
            description: undefined,
            required: c.semantic === "identifier" ? c.required : false,
          })),
          "Shortened the form",
        ),
    };
  }
  if (/nit/i.test(text) && /valid/i.test(text)) {
    const target = findByMention(form.components, "nit");
    if (!target) return { summary: [], valid: false, issues: ["No NIT field yet. Ask to add one."], apply: (f) => f };
    return {
      summary: ["Add Colombian NIT format validation"],
      valid: true,
      issues,
      apply: (current) =>
        withComponents(
          current,
          mapComponents(current.components, (c) =>
            c.id === target.id
              ? { ...c, validate: { ...(c.validate ?? {}), pattern: "^\\d{8,10}(-\\d)?$", patternMessage: "Use a Colombian NIT, for example 900123456-1" } }
              : c,
          ),
          "Added NIT validation",
        ),
    };
  }

  return {
    summary: [],
    valid: false,
    issues: ["Try: “Make address optional”, “Add tax ID”, “Only show NIT if supplierType == colombian_company”, “Turn this into a 3-step wizard”, or “Add validation for Colombian NIT”."],
    apply: (f) => f,
  };
}
