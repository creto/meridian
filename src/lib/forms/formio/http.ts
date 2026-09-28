import {
  applicableSettings,
  componentInventory,
  defaultSchema,
  FORMIO_INVENTORY,
  registeredFormioTypes,
  tabsFor,
} from "./adapter.ts";
import { classifySetting } from "./parity-status.ts";

export function componentTypesBody(splat: string): { status: number; body: unknown } {
  const parts = splat.split("/").filter(Boolean);
  if (parts.length === 0) {
    return {
      status: 200,
      body: {
        package: FORMIO_INVENTORY.package,
        version: FORMIO_INVENTORY.version,
        license: FORMIO_INVENTORY.license,
        types: registeredFormioTypes().map((type) => {
          const item = componentInventory(type)!;
          return {
            type,
            title: item.title,
            group: item.group,
            icon: item.icon,
            weight: item.weight,
            effectivePropertyCount: item.effectivePropertyCount,
          };
        }),
      },
    };
  }
  const type = parts[0]!;
  const item = componentInventory(type);
  if (!item) return { status: 404, body: { error: `Unknown component type ${type}` } };
  const leaf = parts[1] ?? "";
  if (parts.length === 1) {
    return {
      status: 200,
      body: {
        type,
        title: item.title,
        group: item.group,
        icon: item.icon,
        documentation: item.documentation,
        effectivePropertyCount: item.effectivePropertyCount,
        tabs: item.tabOrder,
      },
    };
  }
  if (leaf === "default-schema" && parts.length === 2) {
    return { status: 200, body: { type, schema: defaultSchema(type) } };
  }
  if (leaf === "settings-schema" && parts.length === 2) {
    return {
      status: 200,
      body: {
        type,
        tabs: tabsFor(type).map((tab) => ({
          key: tab.key,
          label: tab.label,
          settings: tab.settings.filter((setting) => setting.key && !setting.ignored).map((setting) => ({
            key: setting.key,
            label: setting.label,
            editorType: setting.editorType,
            tooltip: setting.tooltip,
            defaultValue: setting.defaultValue,
            options: setting.options,
            conditional: setting.conditional,
            parity: classifySetting(type, setting),
          })),
        })),
        applicable: applicableSettings(type).map((setting) => setting.key),
      },
    };
  }
  return { status: 404, body: { error: "Unknown component-type route" } };
}
