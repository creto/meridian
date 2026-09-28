export interface MeridianPlugin {
  id: string;
  version: string;
  setup(): void;
}

export interface MeridianComponentPlugin extends MeridianPlugin {
  type: string;
  builder: { title: string; group: string };
  validate(value: unknown): string | null;
}

export interface MeridianStoragePlugin extends MeridianPlugin {
  kind: string;
  test(): Promise<{ ok: boolean; message: string }>;
}

export interface MeridianEcmPlugin extends MeridianPlugin {
  kind: string;
  upload(folder: string, name: string, body: Uint8Array): Promise<{ id: string }>;
}

export interface MeridianAiPlugin extends MeridianPlugin {
  complete(prompt: string): Promise<{ text: string }>;
}

export interface MeridianWorkflowNodePlugin extends MeridianPlugin {
  nodeType: string;
  run(input: unknown): Promise<{ ok: boolean; output?: unknown }>;
}

export interface MeridianImporterPlugin extends MeridianPlugin {
  accept: string[];
  import(text: string): { title: string; fields: string[] };
}

export interface MeridianExporterPlugin extends MeridianPlugin {
  format: string;
  export(rows: unknown[]): Uint8Array;
}

export interface MeridianValidatorPlugin extends MeridianPlugin {
  key: string;
  check(value: unknown, ctx: Record<string, unknown>): string | null;
}

export const TRUST = [
  "Plugins run in-process with the server.",
  "Only ids on the tenant allowlist, or a 128-hex signature pinned to a trusted key id, may register.",
  "Untrusted packages from the network are never loaded automatically.",
  "Component names cannot contain path separators.",
].join(" ");

export function validateComponentName(name: string): string {
  if (!/^[A-Z][A-Za-z0-9]{1,40}$/.test(name)) throw new Error("Component name must be PascalCase");
  if (name.includes("/") || name.includes("\\") || name.includes("..")) throw new Error("Path traversal");
  return name;
}

export function assertTrustedPlugin(manifest: { id: string; signature?: string; keyId?: string }, allowlist: string[], trustedKeys: string[]): void {
  if (allowlist.includes(manifest.id)) return;
  if (manifest.signature && /^[a-f0-9]{128}$/.test(manifest.signature) && manifest.keyId && trustedKeys.includes(manifest.keyId)) return;
  throw new Error(`Plugin ${manifest.id} is not trusted. ${TRUST}`);
}

export function scaffoldComponent(name: string): Record<string, string> {
  const safe = validateComponentName(name);
  const type = safe.replace(/[A-Z]/g, (letter, index: number) => (index ? "-" : "") + letter.toLowerCase()).replace(/^-/, "");
  return {
    [`${safe}.definition.ts`]: `export const ${safe}Definition = { type: "${type}", title: "${safe}", group: "custom" } as const;\n`,
    [`${safe}.inspector.ts`]: `export const ${safe}Inspector = { fields: ["label", "key", "required", "placeholder"] } as const;\n`,
    [`${safe}.renderer.tsx`]: `export function ${safe}Renderer(props: { value: string; onChange: (value: string) => void; label: string }) {\n  return <label>{props.label}<input value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>;\n}\n`,
    [`${safe}.validator.ts`]: `export function validate${safe}(value: unknown): string | null {\n  if (typeof value !== "string" || !value.trim()) return "${safe} is required";\n  return null;\n}\n`,
    [`${safe}.test.ts`]: `import assert from "node:assert/strict";\nimport test from "node:test";\nimport { validate${safe} } from "./${safe}.validator.ts";\n\ntest("${safe} rejects an empty value", () => {\n  assert.equal(validate${safe}("  "), "${safe} is required");\n  assert.equal(validate${safe}("ok"), null);\n});\n`,
    [`${safe}.register.ts`]: `import { ${safe}Definition } from "./${safe}.definition.ts";\nexport function register${safe}(plugins: { register: (def: typeof ${safe}Definition) => void }) {\n  plugins.register(${safe}Definition);\n}\n`,
  };
}
