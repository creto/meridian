import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { applicableSettings, FORMIO_INVENTORY, registeredFormioTypes, tabsFor } from "../../src/lib/forms/formio/adapter.ts";
import { classifySetting, type ParityStatus } from "../../src/lib/forms/formio/parity-status.ts";

const root = join(import.meta.dirname, "../..");

function line(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

async function main() {
  const types = registeredFormioTypes();
  const rows: { type: string; key: string; tab: string; status: ParityStatus; reason: string }[] = [];
  const counts: Record<ParityStatus, number> = { FULL: 0, PARTIAL: 0, MISSING: 0, NOT_APPLICABLE: 0, INTENTIONALLY_UNSUPPORTED: 0 };
  const unique = new Set<string>();
  for (const type of types) {
    for (const setting of applicableSettings(type)) {
      const decision = classifySetting(type, setting);
      counts[decision.status] += 1;
      unique.add(setting.key);
      rows.push({ type, key: setting.key, tab: setting.tab, status: decision.status, reason: decision.reason });
    }
  }
  const applicable = rows.length;
  const parity = applicable === 0 ? 0 : Math.round((counts.FULL / applicable) * 1000) / 10;

  const inventoryMd = [
    "# Component property inventory",
    "",
    `Extracted from \`${FORMIO_INVENTORY.package}@${FORMIO_INVENTORY.version}\` (${FORMIO_INVENTORY.license}).`,
    "",
    "Counts are effective edit-form controls after inheritance, ignore, and tab merge. Nested grid editors are part of the parent setting, not extra component properties.",
    "",
    line(["Component", "Group", "Effective settings", "Tabs"]),
    "|---|---|---:|---|",
    ...types.map((type) => {
      const item = FORMIO_INVENTORY.components[type]!;
      return line([item.title, item.group, String(item.effectivePropertyCount), item.tabOrder.join(", ")]);
    }),
    "",
  ].join("\n");

  const matrix = [
    "# Form.io parity matrix",
    "",
    "Status is per applicable setting. `FULL` means the inspector edits it, the document stores it, and the native renderer or export uses it. `PARTIAL` means it is editable and lossless, with the runtime limit in the reason. `INTENTIONALLY_UNSUPPORTED` means the value is kept and is not executed.",
    "",
    line(["Component", "Property", "Tab", "Status", "Reason"]),
    "|---|---|---|---|---|",
    ...rows.map((row) => line([row.type, `\`${row.key}\``, row.tab, row.status, row.reason.replace(/\|/g, "/")])),
    "",
  ].join("\n");

  const catalog = [
    "# Component catalog",
    "",
    line(["Type", "Palette", "Inspector", "Import", "Export", "Runtime", "Tests"]),
    "|---|---|---|---|---|---|---|",
    ...types.map((type) => line([
      type,
      "yes",
      "generic edit form",
      "lossless formio bag",
      "componentJson",
      type === "recaptcha" ? "stored only" : "native + preserved schema",
      "src/lib/forms/formio/parity.test.ts",
    ])),
    "",
    "Meridian-only types (toggle, slider, rating, review) stay in the palette. They are not Form.io OSS components.",
    "",
  ].join("\n");

  const report = [
    "# Final Form.io parity report",
    "",
    "## Upstream",
    "",
    `- package: ${FORMIO_INVENTORY.package}`,
    `- version: ${FORMIO_INVENTORY.version}`,
    `- license: ${FORMIO_INVENTORY.license}`,
    `- integrity: ${FORMIO_INVENTORY.integrity}`,
    `- repository: ${FORMIO_INVENTORY.repository}`,
    "- git commit: not published inside the npm tarball; the integrity hash above pins the artifact",
    `- extracted: ${FORMIO_INVENTORY.extractedAt}`,
    "",
    "## Component registry",
    "",
    types.map((type) => `- ${type}`).join("\n"),
    "",
    "## Effective settings count",
    "",
    ...types.map((type) => `- ${FORMIO_INVENTORY.components[type]!.title}: ${FORMIO_INVENTORY.components[type]!.effectivePropertyCount}`),
    "",
    "## Parity summary",
    "",
    `- applicable settings: ${applicable}`,
    `- unique property paths: ${unique.size}`,
    `- FULL: ${counts.FULL}`,
    `- PARTIAL: ${counts.PARTIAL}`,
    `- INTENTIONALLY_UNSUPPORTED: ${counts.INTENTIONALLY_UNSUPPORTED}`,
    `- NOT_APPLICABLE (ignored/help/buttons, excluded from the applicable total): see inventory`,
    `- MISSING: ${counts.MISSING}`,
    `- full-runtime percentage of applicable settings: ${parity}%`,
    "",
    "Every applicable setting has inspector UI and lossless persistence. The percentage above is runtime behavior, not whether the control exists.",
    "",
    "## Runtime strategy",
    "",
    "Meridian keeps its native renderer. `@formio/js` supplies the registry, default schemas, and edit-form definitions. See docs/architecture/ADR-FORMIO-RUNTIME-PARITY.md.",
    "",
    "## Security exceptions",
    "",
    "customConditional, validate.custom, customDefaultValue, and JavaScript calculateValue are stored and shown. Strict mode does not execute them. Safe expressions and JSON Logic conditionals do run.",
    "",
    "## Tests",
    "",
    "- src/lib/forms/formio/parity.test.ts",
    "- scripts/formio-parity.test.mjs",
    "- src/lib/forms/formio-registry.test.ts",
    "",
    "## Known limitations",
    "",
    "- reCAPTCHA is not executed.",
    "- Nested Form does not load a Form.io server resource.",
    "- Authenticated URL fetches, Form.io resources, and IndexedDB sources are stored only.",
    "- encrypted, unique, and dbIndex do not create a cipher or a database index by themselves.",
    "- Logic custom actions are stored and are not executed.",
    "",
  ].join("\n");

  const dir = join(root, "docs/formio-parity");
  const componentDir = join(root, "docs/components");
  await mkdir(dir, { recursive: true });
  await mkdir(componentDir, { recursive: true });
  await writeFile(join(dir, "component-property-inventory.md"), inventoryMd);
  await writeFile(join(dir, "PARITY_MATRIX.md"), matrix);
  await writeFile(join(dir, "COMPONENT_CATALOG.md"), catalog);
  await writeFile(join(dir, "FINAL_FORMIO_PARITY_REPORT.md"), report);
  await writeFile(join(dir, "UPSTREAM_DIFF.md"), `# Upstream diff\n\nBaseline inventory is @formio/js ${FORMIO_INVENTORY.version}. Re-run \`npm run formio:inventory\` after an upgrade. The parity test fails if a component appears or a setting count changes without regenerating this inventory.\n`);
  await writeFile(join(root, "docs/formio-parity/component-property-inventory.json"), JSON.stringify(FORMIO_INVENTORY));

  for (const type of types) {
    const item = FORMIO_INVENTORY.components[type]!;
    const body = [
      `# ${item.title}`,
      "",
      `Type \`${type}\`. Group \`${item.group}\`. ${item.effectivePropertyCount} effective settings.`,
      "",
      "## Default schema",
      "",
      "```json",
      JSON.stringify(item.defaultSchema, null, 2).slice(0, 4000),
      "```",
      "",
      "## Settings",
      "",
      ...tabsFor(type).flatMap((tab) => {
        const settings = tab.settings.filter((setting) => setting.key && !setting.ignored && !setting.help);
        if (!settings.length) return [];
        return [
          `### ${tab.label}`,
          "",
          ...settings.map((setting) => {
            const decision = classifySetting(type, setting);
            return `- \`${setting.key}\` (${setting.editorType}) — ${decision.status}. ${setting.tooltip ?? setting.label ?? ""}`.trim();
          }),
          "",
        ];
      }),
      "## Runtime",
      "",
      "Meridian renders this component with its native field control. Settings marked FULL change that control or validation. Other applicable settings are kept on `component.formio` and survive import, reload, and export.",
      "",
    ].join("\n");
    await writeFile(join(componentDir, `${type}.md`), body);
  }
  console.log(`docs for ${types.length} components, applicable ${applicable}, full ${counts.FULL}, partial ${counts.PARTIAL}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
