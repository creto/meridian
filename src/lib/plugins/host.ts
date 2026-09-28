import { assertTrustedPlugin, scaffoldComponent, validateComponentName, type MeridianComponentPlugin } from "./scaffold.ts";

export interface RegisteredComponent {
  id: string;
  type: string;
  title: string;
  group: string;
  validate: (value: unknown) => string | null;
}

export interface PluginHost {
  components: Map<string, RegisteredComponent>;
}

export function createHost(): PluginHost {
  return { components: new Map() };
}

export function registerComponent(
  host: PluginHost,
  plugin: MeridianComponentPlugin,
  allowlist: string[],
  trustedKeys: string[],
  signature?: { signature: string; keyId: string },
): RegisteredComponent {
  assertTrustedPlugin({ id: plugin.id, signature: signature?.signature, keyId: signature?.keyId }, allowlist, trustedKeys);
  validateComponentName(plugin.builder.title.replace(/[^A-Za-z0-9]/g, "") || "CustomField");
  const component: RegisteredComponent = {
    id: plugin.id,
    type: plugin.type,
    title: plugin.builder.title,
    group: plugin.builder.group,
    validate: (value) => plugin.validate(value),
  };
  host.components.set(plugin.type, component);
  return component;
}

export function renderValue(host: PluginHost, type: string, value: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const component = host.components.get(type);
  if (!component) return { ok: false, error: `Unknown component ${type}` };
  const error = component.validate(value);
  if (error) return { ok: false, error };
  return { ok: true, value };
}

export interface GeneratedPlugin {
  name: string;
  files: Record<string, string>;
  plugin: MeridianComponentPlugin;
}

/** Build the scaffold and a runnable in-process plugin. Files are source text, not written to disk. */
export function generateComponent(name: string): GeneratedPlugin {
  const safe = validateComponentName(name);
  const files = scaffoldComponent(safe);
  const type = safe.replace(/[A-Z]/g, (letter, index: number) => (index ? "-" : "") + letter.toLowerCase()).replace(/^-/, "");
  const plugin: MeridianComponentPlugin = {
    id: `plugin_${type}`,
    version: "1.0.0",
    type,
    builder: { title: safe, group: "custom" },
    setup() {},
    validate(value: unknown) {
      if (typeof value !== "string" || !value.trim()) return `${safe} is required`;
      return null;
    },
  };
  return { name: safe, files, plugin };
}
