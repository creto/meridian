import assert from "node:assert/strict";
import { test } from "node:test";
import inventory from "../src/lib/forms/formio/inventory.generated.json" with { type: "json" };
import { extractInventory } from "../tools/formio-audit/extract-component-settings.mjs";

test("committed inventory matches the installed @formio/js edit forms", async () => {
  const live = await extractInventory();
  assert.equal(live.version, inventory.version);
  assert.deepEqual(Object.keys(live.components).sort(), Object.keys(inventory.components).sort());
  for (const type of Object.keys(live.components)) {
    assert.equal(
      live.components[type].effectivePropertyCount,
      inventory.components[type].effectivePropertyCount,
      type,
    );
    assert.deepEqual(live.components[type].tabOrder, inventory.components[type].tabOrder, type);
  }
});
