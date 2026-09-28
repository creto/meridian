# ADR: Form.io runtime parity

## Status

Accepted for the current builder.

## Context

Meridian already renders forms with its own React runtime, safe expression language, and strict refusal to execute imported JavaScript. `@formio/js` 5.2.4 (MIT) is the approved open-source definition of component types, default schemas, and edit forms.

Replacing the filler with the Form.io renderer would execute upstream JavaScript, drop the Meridian visual system, and pull a browser-only bundle into every submission. That is a stronger architectural break than this repository allows.

## Decision

- The builder inspector is generated from each component's effective `editForm()`, including inherited tabs and `ignore`.
- Component JSON is lossless. Unknown keys live on `formio` and are exported with the typed fields.
- The native renderer implements the behavioral settings (masks, validation, clear-on-hide, simple and JSON Logic conditionals, safe calculations, select values/JSON/http(s) URLs, file limits, survey, day, tags, prefixes, and submission redaction).
- Arbitrary JavaScript (`customConditional`, `validate.custom`, JavaScript `calculateValue`, logic custom actions) is preserved and is not executed.
- reCAPTCHA and Form.io resource/IndexedDB sources are preserved and are not executed.

## Consequences

A future `@formio/js` upgrade is detected by `npm run formio:parity`, which rebuilds the edit forms and compares them to `src/lib/forms/formio/inventory.generated.json`. A new component or a changed setting count fails CI until the inventory and parity report are regenerated.
