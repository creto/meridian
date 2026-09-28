import { base64ToBytes } from "./http.ts";
import { createLocalProvider } from "./local.ts";
import { createCmis, createSharePoint, putAzure, putGcs, putRest, testAzure, testCmis, testGcs, testRest, testSharePoint, type AzureConfig, type CmisConfig, type GcsConfig, type RestConfig, type SharePointConfig } from "./providers.ts";
import { createS3Provider, testS3, type S3Config } from "./s3.ts";
import type { StorageKind } from "./types.ts";

function flag(value: string | undefined) {
  return value === "true" || value === "1";
}

function s3config(config: Record<string, string>, secret: string | undefined, kind: StorageKind): S3Config {
  return {
    endpoint: config.endpoint,
    region: config.region || "us-east-1",
    bucket: config.bucket || "",
    accessKeyId: config.accessKeyId || "",
    secretAccessKey: secret || "",
    pathStyle: kind === "minio" || flag(config.pathStyle),
    prefix: config.prefix,
  };
}

export async function runStorageTest(kind: StorageKind, config: Record<string, string>, secret: string | undefined) {
  if (kind === "local") {
    const provider = createLocalProvider();
    const put = await provider.put({ key: "meridian-healthcheck.txt", body: new TextEncoder().encode("meridian"), contentType: "text/plain" });
    if (!put.ok) return put;
    const got = await provider.get(put.key);
    await provider.delete(put.key);
    if (!got.ok) return got;
    return { ok: true as const, message: `Workspace archive stored and read ${put.bytes} bytes`, requestId: put.requestId };
  }
  if (kind === "s3" || kind === "minio") return testS3(s3config(config, secret, kind));
  if (kind === "azure-blob") return testAzure({ account: config.account || "", container: config.container || "", accountKey: secret || "", prefix: config.prefix } satisfies AzureConfig);
  if (kind === "gcs") return testGcs({ bucket: config.bucket || "", accessToken: secret || "", prefix: config.prefix } satisfies GcsConfig);
  if (kind === "sharepoint") {
    return testSharePoint({
      tenant: config.tenant || "",
      clientId: config.clientId || "",
      clientSecret: secret || "",
      site: config.site || "",
      drive: config.drive,
      folder: config.folder,
    } satisfies SharePointConfig);
  }
  if (kind === "cmis") {
    return testCmis({
      browserUrl: config.browserUrl || "",
      repositoryId: config.repositoryId,
      username: config.username,
      password: secret,
      folder: config.folder,
    } satisfies CmisConfig);
  }
  return testRest({ endpoint: config.endpoint || "", bearer: secret, prefix: config.prefix } satisfies RestConfig);
}

export async function runStoragePut(kind: StorageKind, config: Record<string, string>, secret: string | undefined, key: string, bodyBase64: string, contentType: string) {
  const body = base64ToBytes(bodyBase64);
  if (kind === "local") return createLocalProvider().put({ key, body, contentType });
  if (kind === "s3" || kind === "minio") return createS3Provider(s3config(config, secret, kind)).put({ key, body, contentType });
  if (kind === "azure-blob") return putAzure({ account: config.account || "", container: config.container || "", accountKey: secret || "", prefix: config.prefix }, { key, body, contentType });
  if (kind === "gcs") return putGcs({ bucket: config.bucket || "", accessToken: secret || "", prefix: config.prefix }, { key, body, contentType });
  if (kind === "sharepoint") {
    return createSharePoint({
      tenant: config.tenant || "",
      clientId: config.clientId || "",
      clientSecret: secret || "",
      site: config.site || "",
      drive: config.drive,
      folder: config.folder,
    }).uploadDocument({ key, body, contentType, folder: config.folder || "" });
  }
  if (kind === "cmis") {
    return createCmis({
      browserUrl: config.browserUrl || "",
      repositoryId: config.repositoryId,
      username: config.username,
      password: secret,
      folder: config.folder,
    }).uploadDocument({ key, body, contentType, folder: config.folder || "" });
  }
  return putRest({ endpoint: config.endpoint || "", bearer: secret, prefix: config.prefix }, { key, body, contentType });
}
