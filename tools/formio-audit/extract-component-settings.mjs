/**
 * Load the installed @formio/js registry and write the effective edit-form
 * inventory. Run: node tools/formio-audit/extract-component-settings.mjs
 *
 * The DOM shim exists only so the browser-oriented package can be imported
 * from Node. It is not a renderer.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function installDomShim() {
  if (globalThis.__meridianFormioShim) return;
  const el = () => {
    const node = {
      style: {},
      setAttribute() {},
      getAttribute() {
        return null;
      },
      appendChild() {
        return node;
      },
      removeChild() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      addEventListener() {},
      removeEventListener() {},
      getContext() {
        return { measureText: () => ({ width: 0 }), fillRect() {}, clearRect() {} };
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      childNodes: [],
      children: [],
      getBoundingClientRect() {
        return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 };
      },
    };
    return node;
  };
  Object.assign(globalThis, {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  });
  globalThis.window = globalThis;
  globalThis.self = globalThis;
  globalThis.document = {
    createElement: el,
    createElementNS: el,
    createTextNode: (text) => ({ textContent: text }),
    querySelector: () => null,
    querySelectorAll: () => [],
    body: el(),
    head: el(),
    documentElement: { style: {} },
    addEventListener() {},
    removeEventListener() {},
    getElementById: () => null,
    createRange: () => ({
      selectNodeContents() {},
      getBoundingClientRect: () => ({ width: 0 }),
      getClientRects: () => [],
    }),
    createDocumentFragment: el,
  };
  globalThis.matchMedia = () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  });
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 16);
  globalThis.getComputedStyle = () => new Proxy({}, { get: () => "" });
  globalThis.HTMLElement = class {};
  globalThis.Element = class {};
  globalThis.Node = class {};
  globalThis.Event = class {
    constructor(type) {
      this.type = type;
    }
    preventDefault() {}
    stopPropagation() {}
  };
  globalThis.CustomEvent = class extends Event {};
  globalThis.MouseEvent = class extends Event {};
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  globalThis.location = { href: "http://localhost/", origin: "http://localhost" };
  globalThis.__meridianFormioShim = true;
}

function plain(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === "function") return undefined;
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth > 6) return undefined;
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => plain(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (key.startsWith("_") || key === "componentsMap") continue;
      const next = plain(item, depth + 1);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return undefined;
}

function optionsOf(node) {
  const values = Array.isArray(node?.data?.values) ? node.data.values : Array.isArray(node?.values) ? node.values : null;
  if (!values) return undefined;
  return values.slice(0, 60).map((item) => {
    if (item == null || typeof item !== "object") return { label: String(item), value: String(item) };
    const value = item.value == null ? String(item.label ?? "") : typeof item.value === "object" ? JSON.stringify(item.value) : String(item.value);
    return { label: String(item.label ?? value), value };
  });
}

const TRAVERSE = new Set(["panel", "fieldset", "well", "columns", "tabs", "table"]);

function serialize(node, tab, depth) {
  if (!node || typeof node !== "object" || depth > 5) return [];
  if (node.type === "columns") {
    return (node.columns ?? []).flatMap((col) => (col?.components ?? []).flatMap((child) => serialize(child, tab, depth + 1)));
  }
  if (TRAVERSE.has(node.type) && node.input !== true && node.type !== "datagrid") {
    return (node.components ?? []).flatMap((child) => serialize(child, tab, depth + 1));
  }
  if (node.ignore) {
    return [{
      key: String(node.key ?? ""),
      label: node.label ? String(node.label) : undefined,
      tab,
      editorType: String(node.type ?? "unknown"),
      ignored: true,
      weight: typeof node.weight === "number" ? node.weight : undefined,
    }];
  }
  if (!node.key) {
    if (node.type === "htmlelement" || node.type === "content") {
      const content = typeof node.content === "string" ? node.content : typeof node.html === "string" ? node.html : typeof node.tag === "string" ? node.tag : "";
      return [{
        key: "",
        tab,
        editorType: "html",
        help: true,
        label: node.label ? String(node.label) : undefined,
        description: content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
      }];
    }
    return [];
  }
  const setting = {
    key: String(node.key),
    label: node.label ? String(node.label) : undefined,
    tab,
    editorType: String(node.type ?? "textfield"),
    weight: typeof node.weight === "number" ? node.weight : undefined,
    tooltip: typeof node.tooltip === "string" ? node.tooltip.slice(0, 500) : undefined,
    description: typeof node.description === "string" ? node.description.slice(0, 500) : undefined,
    placeholder: typeof node.placeholder === "string" ? node.placeholder.slice(0, 200) : undefined,
    defaultValue: plain(node.defaultValue),
    options: optionsOf(node),
    multiple: node.multiple === true ? true : undefined,
    conditional: plain(node.conditional),
    customConditional: typeof node.customConditional === "string" ? node.customConditional.slice(0, 1500) : undefined,
    rows: typeof node.rows === "number" ? node.rows : undefined,
    editor: typeof node.editor === "string" ? node.editor : undefined,
  };
  if (["datagrid", "editgrid", "datamap", "container", "survey"].includes(node.type) && Array.isArray(node.components)) {
    setting.itemFields = node.components.flatMap((child) => serialize(child, tab, depth + 1)).filter((child) => child.key || child.help);
  }
  return [setting];
}

const BASES = new Set(["base", "component", "componentmodal", "field", "input", "list", "multivalue", "nested", "nestedarray", "nesteddata", "unknown"]);

export async function extractInventory() {
  installDomShim();
  const loaded = await import("@formio/js");
  const comps = loaded.Formio.Components.components;
  const pkg = JSON.parse(readFileSync(join(root, "node_modules/@formio/js/package.json"), "utf8"));
  const components = {};
  for (const type of Object.keys(comps).sort()) {
    if (BASES.has(type)) continue;
    const Comp = comps[type];
    if (typeof Comp?.editForm !== "function") continue;
    let edit;
    let schema = {};
    try {
      edit = Comp.editForm();
    } catch {
      continue;
    }
    try {
      schema = typeof Comp.schema === "function" ? plain(Comp.schema()) ?? {} : {};
    } catch {
      schema = {};
    }
    const root = Array.isArray(edit) ? edit : edit?.components ?? [];
    const tabsNode = root.find((item) => item?.type === "tabs");
    const tabs = {};
    const order = [];
    for (const tab of tabsNode?.components ?? []) {
      const key = String(tab.key ?? tab.label ?? "settings");
      order.push(key);
      tabs[key] = (tab.components ?? []).flatMap((child) => serialize(child, key, 0));
    }
    const info = Comp.builderInfo ?? {};
    const settings = Object.values(tabs).flat().filter((item) => item.key && !item.ignored && !item.help);
    components[type] = {
      type,
      title: info.title ? String(info.title) : type,
      group: info.group ? String(info.group) : "advanced",
      icon: info.icon ? String(info.icon) : undefined,
      weight: typeof info.weight === "number" ? info.weight : undefined,
      documentation: info.documentation ? String(info.documentation) : undefined,
      tabOrder: order,
      defaultSchema: schema,
      tabs,
      effectivePropertyCount: settings.length,
    };
  }
  return {
    package: "@formio/js",
    version: pkg.version,
    license: pkg.license,
    integrity: "sha512-mQfZ/Vd5cVpCCLnPhZVXTA99F1Jq86W1VU+bx17m95YYQXwyajhXUijtki5be3Xk9DH5spYxajB4Q4XVy5Udzw==",
    repository: "https://github.com/formio/formio.js",
    extractedAt: new Date().toISOString(),
    bases: [...BASES],
    components,
  };
}

async function main() {
  const inventory = await extractInventory();
  const target = join(root, "src/lib/forms/formio/inventory.generated.json");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(inventory));
  const counts = Object.values(inventory.components)
    .map((item) => `${item.type}\t${item.effectivePropertyCount}\t${item.group}`)
    .join("\n");
  console.log(`components ${Object.keys(inventory.components).length}`);
  console.log(counts);
  console.log(`wrote ${target}`);
}

if (process.argv[1] && process.argv[1].endsWith("extract-component-settings.mjs")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
