# Security

## Identity

- Local passwords use Argon2id (`src/lib/identity/passwords.ts`). Older scrypt records still verify.
- Sessions can be revoked from Admin. Disabling a user revokes open sessions in the same command.
- OIDC builds an authorization URL with PKCE, state, and nonce. The callback rejects a reused state and a mismatched nonce. ID token signatures are not checked against a JWKS. Do not treat OIDC as production login until that check exists.

## Authorization

- Publication modes are enforced by `admitFill` and `POST /api/platform/fill/admit`.
- Signed prefill tokens bind tenant and form. Query parameters and the JSON body cannot overwrite protected fields.
- ABAC expressions use the safe expression parser. There is no `eval`.

## Requests

- SSRF checks reject link-local and metadata addresses before a lookup or a REST ECM call.
- Uploads must match a declared MIME type by magic bytes for PDF, PNG, JPEG, and GIF. HTML, SVG, and executable names are refused.
- Admin pages do not select password hashes, API secrets, or storage ciphertext.
- Connection credentials must be stored as `secret:` references.

## Audit

Mutations from the admin console append a hash-chained audit row. Exporting the audit log writes an `audit.export` event.
