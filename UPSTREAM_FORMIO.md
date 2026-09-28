# Upstream Form.io

Approved package: `@formio/js` 5.2.4

- License: MIT
- Repository: https://github.com/formio/formio.js
- Integrity: `sha512-mQfZ/Vd5cVpCCLnPhZVXTA99F1Jq86W1VU+bx17m95YYQXwyajhXUijtki5be3Xk9DH5spYxajB4Q4XVy5Udzw==`
- Imported: 2026-09-28
- Local change: Meridian does not fork the renderer. It reads the registry and edit forms, then keeps a generated inventory in `src/lib/forms/formio/inventory.generated.json`.

Enterprise and premium closed source are not vendored. The File and Nested Form components that ship inside this MIT package are included. Nested Form resource loading and reCAPTCHA execution are not.

Regenerate with `npm run formio:inventory`.
