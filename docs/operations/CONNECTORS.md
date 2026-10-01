# Connectors

Without credentials the connector stays off. A job is not marked sent, uploaded, or discovered.

| Path | Required variables | What a round trip does |
| --- | --- | --- |
| SMTP | `SMTP_URL` | EHLO, MAIL FROM, RCPT TO, DATA against that server |
| OIDC | `OIDC_ISSUER`, `OIDC_CLIENT_ID` | GET `/.well-known/openid-configuration` and require auth and token endpoints |
| S3 | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | SigV4 PUT then GET of `meridian-healthcheck.txt` |
| ECM | `ECM_BASE_URL` | PUT then GET. Private addresses are blocked in production |

`src/lib/connectors/roundtrip.test.ts` runs those four dialogues against local servers. That is not a tenant's SMTP, IdP, bucket, or ECM. Compose leaves SMTP and OIDC unset on purpose.
