# Form.io upstream

Meridian does not vendor the Form.io server. Form definitions in this repository are Meridian's own schema.

The Form.io importer (`src/lib/import`) reads a Form.io JSON document into Meridian components. It does not call form.io at runtime and it does not keep a fork of that project.

When Form.io adds a component type, the importer and `src/lib/forms/component-registry.ts` need an explicit mapping. Unknown types should fail the import rather than being dropped silently. Check the importer tests before changing that behavior.

Angular rendering is the view-model package in `packages/angular`. It is not an upstream Form.io Angular distribution.
