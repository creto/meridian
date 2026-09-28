# Connectors

`GET /api/platform/connectors` returns the capability matrix from `src/lib/storage/capability.ts`.

Support is one of `implemented`, `partial`, `missing`, or `not-applicable`. A partial cell is not a finished connector.

## Providers

| Provider | Put / get | Signed URL | Notes |
|---|---|---|---|
| S3 and MinIO | implemented | implemented | MinIO uses the S3 client with another endpoint |
| GCS | implemented | implemented | Token exchange exists |
| Azure Blob | implemented | partial | Shared key, not user-delegation SAS |
| SharePoint | implemented | not applicable | Graph upload session |
| CMIS | implemented | not applicable | Browser binding |
| REST ECM | request builder | n/a | SSRF checks are required. Delete is not implemented |
| Local and memory | implemented | missing | Preview and tests |

Admin can save a connection row with a `secret:` name. Test checks the endpoint shape and the SSRF guard. It does not open a socket to the provider.

Do not paste a raw access key into the connection form.
