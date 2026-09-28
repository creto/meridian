/**
 * Connector capability matrix and large-upload planning.
 * Live credentials are not required. The matrix records what each adapter implements
 * and what still needs a reached network to prove.
 */
import { createHash } from "node:crypto";
import { blockedDestination } from "../security/ssrf.ts";

export type ConnectorId = "s3" | "minio" | "gcs" | "azure-blob" | "sharepoint" | "cmis" | "rest" | "memory" | "local";

export type Capability =
  | "put"
  | "get"
  | "delete"
  | "list"
  | "stat"
  | "signed-download"
  | "signed-upload"
  | "large-upload"
  | "metadata"
  | "retry"
  | "token-refresh"
  | "error-normalization";

export type Support = "implemented" | "partial" | "missing" | "not-applicable";

export interface CapabilityCell {
  connector: ConnectorId;
  capability: Capability;
  support: Support;
  evidence: string;
}

/**
 * Honest matrix from the adapters in this repo.
 * "implemented" means the code path exists. It does not mean a live cloud account was reached.
 */
export function connectorMatrix(): CapabilityCell[] {
  const rows: Array<[ConnectorId, Capability, Support, string]> = [
    ["s3", "put", "implemented", "src/lib/storage/s3.ts createS3Provider.put"],
    ["s3", "get", "implemented", "src/lib/storage/s3.ts get"],
    ["s3", "delete", "implemented", "src/lib/storage/s3.ts delete"],
    ["s3", "list", "implemented", "src/lib/storage/s3.ts list"],
    ["s3", "stat", "implemented", "src/lib/storage/s3.ts stat via HEAD"],
    ["s3", "signed-download", "implemented", "presignAws GET"],
    ["s3", "signed-upload", "implemented", "presignAws PUT"],
    ["s3", "large-upload", "partial", "multipartPut exists; part size is caller-planned"],
    ["s3", "metadata", "partial", "content-type is sent; arbitrary user metadata is not a first-class map"],
    ["s3", "retry", "partial", "fetchRetry is available to callers; the provider itself does not loop"],
    ["s3", "token-refresh", "not-applicable", "SigV4 uses the access key on each request"],
    ["s3", "error-normalization", "implemented", "StorageError code and requestId"],
    ["minio", "put", "implemented", "same S3 provider with a custom endpoint"],
    ["minio", "get", "implemented", "same S3 provider"],
    ["minio", "delete", "implemented", "same S3 provider"],
    ["minio", "list", "implemented", "same S3 provider"],
    ["minio", "stat", "implemented", "same S3 provider"],
    ["minio", "signed-download", "implemented", "presign against the MinIO host"],
    ["minio", "signed-upload", "implemented", "presign against the MinIO host"],
    ["minio", "large-upload", "partial", "multipart depends on the MinIO server"],
    ["minio", "metadata", "partial", "same as S3"],
    ["minio", "retry", "partial", "same as S3"],
    ["minio", "token-refresh", "not-applicable", "static keys"],
    ["minio", "error-normalization", "implemented", "same StorageError"],
    ["gcs", "put", "implemented", "src/lib/storage/gcs-provider.ts"],
    ["gcs", "get", "implemented", "gcs-provider get"],
    ["gcs", "delete", "implemented", "gcs-provider delete"],
    ["gcs", "list", "implemented", "gcs-provider list"],
    ["gcs", "stat", "implemented", "gcs-provider stat"],
    ["gcs", "signed-download", "implemented", "signGcsV4"],
    ["gcs", "signed-upload", "implemented", "signGcsV4 PUT"],
    ["gcs", "large-upload", "partial", "single-shot JSON API; resumable sessions are not wrapped"],
    ["gcs", "metadata", "partial", "content-type only"],
    ["gcs", "retry", "partial", "no internal retry loop"],
    ["gcs", "token-refresh", "implemented", "exchangeGcsAssertion mints a bearer token"],
    ["gcs", "error-normalization", "implemented", "provider error codes"],
    ["azure-blob", "put", "implemented", "src/lib/storage/azure-blob.ts"],
    ["azure-blob", "get", "implemented", "azure get"],
    ["azure-blob", "delete", "implemented", "azure delete"],
    ["azure-blob", "list", "implemented", "azure list"],
    ["azure-blob", "stat", "implemented", "azure stat"],
    ["azure-blob", "signed-download", "partial", "shared-key requests; user-delegation SAS is not minted"],
    ["azure-blob", "signed-upload", "partial", "shared-key PUT; SAS upload URL is not minted"],
    ["azure-blob", "large-upload", "partial", "single PUT; block staging is not wrapped"],
    ["azure-blob", "metadata", "partial", "x-ms-meta is not a general map yet"],
    ["azure-blob", "retry", "partial", "no internal retry loop"],
    ["azure-blob", "token-refresh", "not-applicable", "shared key, not AAD"],
    ["azure-blob", "error-normalization", "implemented", "status mapped to StorageError"],
    ["sharepoint", "put", "implemented", "graph upload session in graph-drive.ts"],
    ["sharepoint", "get", "implemented", "downloadDocument"],
    ["sharepoint", "delete", "partial", "ECM contract has no delete; recycle is not called"],
    ["sharepoint", "list", "implemented", "listFolders and children"],
    ["sharepoint", "stat", "partial", "metadata comes back on upload, not a stat() call"],
    ["sharepoint", "signed-download", "not-applicable", "Graph uses bearer tokens, not presigned URLs"],
    ["sharepoint", "signed-upload", "not-applicable", "upload session URL is the equivalent"],
    ["sharepoint", "large-upload", "implemented", "upload session chunked PUT"],
    ["sharepoint", "metadata", "partial", "name and folder; custom columns are not mapped"],
    ["sharepoint", "retry", "implemented", "401 refresh then retry inside graph-drive"],
    ["sharepoint", "token-refresh", "implemented", "client-credentials token cache"],
    ["sharepoint", "error-normalization", "implemented", "StorageError"],
    ["cmis", "put", "implemented", "createCmisBrowser uploadDocument"],
    ["cmis", "get", "implemented", "download / content stream"],
    ["cmis", "delete", "partial", "not on the ECMProvider interface"],
    ["cmis", "list", "implemented", "children and query"],
    ["cmis", "stat", "partial", "properties on the object, no standalone stat()"],
    ["cmis", "signed-download", "not-applicable", "CMIS uses the repository session"],
    ["cmis", "signed-upload", "not-applicable", "CMIS uses the repository session"],
    ["cmis", "large-upload", "partial", "browser binding content stream; chunking is the server's"],
    ["cmis", "metadata", "implemented", "property map on upload"],
    ["cmis", "retry", "partial", "no internal retry loop"],
    ["cmis", "token-refresh", "partial", "basic or token header supplied by the caller"],
    ["cmis", "error-normalization", "implemented", "StorageError"],
    ["rest", "put", "partial", "putRest posts a body; mapping lives in rest-ecm.ts when present"],
    ["rest", "get", "partial", "depends on the mapping's response URL path"],
    ["rest", "delete", "missing", "no delete template yet"],
    ["rest", "list", "missing", "no list template yet"],
    ["rest", "stat", "missing", "no stat template yet"],
    ["rest", "signed-download", "not-applicable", "the mapped URL is the document URL"],
    ["rest", "signed-upload", "not-applicable", "the mapped URL is the upload URL"],
    ["rest", "large-upload", "partial", "multipart flag on the mapping; streaming is not chunked"],
    ["rest", "metadata", "implemented", "metadata map in the REST ECM mapping"],
    ["rest", "retry", "implemented", "mapping retry delays"],
    ["rest", "token-refresh", "partial", "secret refs are injected; refresh is the caller's"],
    ["rest", "error-normalization", "implemented", "normalizeEcmError"],
    ["memory", "put", "implemented", "createMemoryStorage"],
    ["memory", "get", "implemented", "createMemoryStorage"],
    ["memory", "delete", "implemented", "createMemoryStorage"],
    ["memory", "list", "implemented", "createMemoryStorage"],
    ["memory", "stat", "implemented", "createMemoryStorage"],
    ["memory", "signed-download", "missing", "in-memory provider has no URLs"],
    ["memory", "signed-upload", "missing", "in-memory provider has no URLs"],
    ["memory", "large-upload", "not-applicable", "the bytes are already in process"],
    ["memory", "metadata", "partial", "content-type only"],
    ["memory", "retry", "not-applicable", "no network"],
    ["memory", "token-refresh", "not-applicable", "no network"],
    ["memory", "error-normalization", "implemented", "NOT_FOUND codes"],
    ["local", "put", "implemented", "createLocalProvider"],
    ["local", "get", "implemented", "createLocalProvider"],
    ["local", "delete", "implemented", "createLocalProvider"],
    ["local", "list", "implemented", "createLocalProvider"],
    ["local", "stat", "implemented", "createLocalProvider"],
    ["local", "signed-download", "missing", "disk paths are not signed"],
    ["local", "signed-upload", "missing", "disk paths are not signed"],
    ["local", "large-upload", "partial", "writes the whole buffer"],
    ["local", "metadata", "partial", "content-type only"],
    ["local", "retry", "not-applicable", "local disk"],
    ["local", "token-refresh", "not-applicable", "local disk"],
    ["local", "error-normalization", "implemented", "StorageError"],
  ];
  return rows.map(([connector, capability, support, evidence]) => ({ connector, capability, support, evidence }));
}

export function gapsFor(connector: ConnectorId): CapabilityCell[] {
  return connectorMatrix().filter((cell) => cell.connector === connector && (cell.support === "missing" || cell.support === "partial"));
}

export interface ChunkPlan {
  partSize: number;
  parts: Array<{ partNumber: number; start: number; end: number }>;
  total: number;
}

/** Split a byte length into upload parts. Part numbers are 1-based, as S3 requires. */
export function planChunks(totalBytes: number, partSize: number): ChunkPlan {
  if (!Number.isFinite(totalBytes) || totalBytes < 0) throw new Error("totalBytes must be a non-negative number");
  if (!Number.isInteger(partSize) || partSize < 1) throw new Error("partSize must be a positive integer");
  const parts: ChunkPlan["parts"] = [];
  if (totalBytes === 0) return { partSize, parts, total: 0 };
  let start = 0;
  let partNumber = 1;
  while (start < totalBytes) {
    const end = Math.min(totalBytes, start + partSize);
    parts.push({ partNumber, start, end });
    start = end;
    partNumber += 1;
    if (partNumber > 10_000) throw new Error("Upload exceeds 10000 parts");
  }
  return { partSize, parts, total: totalBytes };
}

export function metadataHeader(metadata: Record<string, string>, prefix: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!/^[A-Za-z0-9-]+$/.test(key)) throw new Error(`Metadata key ${key} is not a token`);
    if (/[\r\n]/.test(value)) throw new Error("Metadata values cannot contain line breaks");
    headers[`${prefix}${key.toLowerCase()}`] = value;
  }
  return headers;
}

export interface NormalizedError {
  code: string;
  retryable: boolean;
  message: string;
}

export function normalizeStatus(status: number, body: string): NormalizedError {
  const message = body.trim().slice(0, 300) || `HTTP ${status}`;
  if (status === 401 || status === 403) return { code: "AUTH", retryable: false, message };
  if (status === 404) return { code: "NOT_FOUND", retryable: false, message };
  if (status === 408 || status === 429) return { code: "THROTTLED", retryable: true, message };
  if (status >= 500) return { code: "UPSTREAM", retryable: true, message };
  if (status >= 400) return { code: "REJECTED", retryable: false, message };
  return { code: "OK", retryable: false, message };
}

export function assertRemoteUrl(url: string): void {
  const blocked = blockedDestination(url);
  if (blocked) throw new Error(blocked);
}

export function etag(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function matrixSummary(): { implemented: number; partial: number; missing: number; notApplicable: number } {
  const cells = connectorMatrix();
  return {
    implemented: cells.filter((cell) => cell.support === "implemented").length,
    partial: cells.filter((cell) => cell.support === "partial").length,
    missing: cells.filter((cell) => cell.support === "missing").length,
    notApplicable: cells.filter((cell) => cell.support === "not-applicable").length,
  };
}
