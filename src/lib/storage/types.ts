export type StorageKind = "local" | "s3" | "minio" | "azure-blob" | "gcs" | "sharepoint" | "cmis" | "rest";

export interface ObjectStat {
  key: string;
  bytes: number;
  sha256: string;
  contentType: string;
  etag?: string;
  lastModified?: string;
}

export interface PutInput {
  key: string;
  body: Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface PutResult {
  ok: true;
  key: string;
  bytes: number;
  sha256: string;
  etag?: string;
  url?: string;
  externalId?: string;
  version?: string;
  requestId: string;
}

export interface StorageError {
  ok: false;
  code: string;
  message: string;
  status?: number;
  requestId: string;
}

export type StorageOutcome = PutResult | StorageError;

export interface ObjectStorageProvider {
  kind: StorageKind;
  put(input: PutInput): Promise<StorageOutcome>;
  get(key: string): Promise<{ ok: true; body: Uint8Array; stat: ObjectStat; requestId: string } | StorageError>;
  delete(key: string): Promise<{ ok: true; requestId: string } | StorageError>;
  exists(key: string): Promise<boolean>;
  stat(key: string): Promise<{ ok: true; stat: ObjectStat; requestId: string } | StorageError>;
  list(prefix: string): Promise<{ ok: true; keys: ObjectStat[]; requestId: string } | StorageError>;
  signedDownloadUrl(key: string, expiresSeconds: number): Promise<{ ok: true; url: string; requestId: string } | StorageError>;
  signedUploadUrl(key: string, expiresSeconds: number, contentType: string): Promise<{ ok: true; url: string; requestId: string } | StorageError>;
}

/** Document services. Distinct from raw object storage: folders, versions, metadata. */
export interface ECMProvider {
  kind: "sharepoint" | "cmis" | "rest";
  testConnection(): Promise<StorageError | { ok: true; message: string; requestId: string }>;
  listFolders(path: string): Promise<{ ok: true; folders: { id: string; name: string; path: string }[]; requestId: string } | StorageError>;
  createFolder(path: string): Promise<{ ok: true; id: string; path: string; requestId: string } | StorageError>;
  uploadDocument(input: PutInput & { folder: string }): Promise<StorageOutcome>;
  downloadDocument(id: string): Promise<{ ok: true; body: Uint8Array; requestId: string } | StorageError>;
}

export interface StorageConnection {
  id: string;
  name: string;
  kind: StorageKind;
  enabled: boolean;
  /** Non-secret settings only. Credentials live in the server vault. */
  config: Record<string, string>;
  secretSet: boolean;
  lastTest?: { ok: boolean; at: string; message: string; status?: number };
}

export interface ExternalReference {
  provider: StorageKind | "local";
  connectionId?: string;
  externalDocumentId?: string;
  externalUrl?: string;
  path: string;
  version?: string;
  uploadTimestamp: string;
  checksum: string;
  error?: string;
}
