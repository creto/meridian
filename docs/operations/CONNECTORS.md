# Connectors

Without credentials the connector stays off. A job is not marked sent, uploaded, or discovered.

| Path | Required variables | What a round trip does |
| --- | --- | --- |
| SMTP | `SMTP_URL` | EHLO, MAIL FROM, RCPT TO, DATA against that server |
| OIDC | `OIDC_ISSUER`, `OIDC_CLIENT_ID` | GET `/.well-known/openid-configuration` and require auth and token endpoints |
| S3 | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | SigV4 PUT then GET of `meridian-healthcheck.txt` |
| ECM | `ECM_BASE_URL` | PUT then GET. Private addresses are blocked in production |

`node scripts/connectors-live.mjs` exits 2 while any of those variables is missing. It does not report success for a connector that has not answered.

`node --experimental-strip-types scripts/exercise-connectors.mjs` starts listeners on this machine and requires SMTP, OIDC discovery, a signed S3 PUT/GET, and an ECM PUT to succeed. Those listeners are not a customer's mailbox, identity provider, bucket, or ECM. The chart does not set those variables, so a deploy stays off.
