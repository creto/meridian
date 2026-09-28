import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import test from "node:test";
import { supplierForm } from "../forms/templates.ts";
import type { Submission } from "../forms/types.ts";
import { advanceServices, startWorkflow } from "../forms/workflow-run.ts";
import { can } from "../platform/rbac.ts";
import { createLocalProvider } from "./local.ts";
import { signAws } from "./sigv4.ts";
import { createS3Provider } from "./s3.ts";

test("sigv4 matches the AWS GET example", async () => {
  const signed = await signAws({
    method: "GET",
    host: "examplebucket.s3.amazonaws.com",
    path: "/test.txt",
    headers: { range: "bytes=0-9" },
    payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    amzDate: "20130524T000000Z",
  });
  assert.equal(signed.signature, "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
});

test("local provider round-trips bytes", async () => {
  const provider = createLocalProvider();
  const body = new TextEncoder().encode("hello archive");
  const put = await provider.put({ key: "a/b.txt", body, contentType: "text/plain" });
  assert.equal(put.ok, true);
  const got = await provider.get("a/b.txt");
  assert.equal(got.ok, true);
  if (got.ok) assert.equal(new TextDecoder().decode(got.body), "hello archive");
  assert.equal(await provider.exists("a/b.txt"), true);
  await provider.delete("a/b.txt");
  assert.equal(await provider.exists("a/b.txt"), false);
});

test("viewer cannot publish and reviewer can approve", () => {
  assert.equal(can("viewer", "form.publish"), false);
  assert.equal(can("reviewer", "workflow.approve"), true);
  assert.equal(can("owner", "storage.manage"), true);
});

test("supplier archive writes a real local pdf", async () => {
  const form = supplierForm();
  const started = startWorkflow(form, "Alex");
  assert.ok(started);
  let submission: Submission = {
    id: "sub_test",
    formId: form.id,
    formName: form.name,
    formVersion: form.version,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "in_review" as const,
    data: { legalName: "Test SAS", nit: "900111222-3" },
    revisions: [],
    documents: [],
    workflow: { currentNode: "pdf", history: started!.history },
  };
  submission = await advanceServices(form, submission, "Meridian");
  const doc = submission.documents.find((item) => item.kind === "filled-pdf");
  assert.ok(doc);
  assert.equal(doc?.error, undefined);
  assert.match(doc?.sha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(submission.workflow?.currentNode, "done");
  const provider = createLocalProvider();
  const stored = await provider.get(doc!.id);
  assert.equal(stored.ok, true);
});

test("s3 client talks to an S3-style fixture", async () => {
  const objects = new Map<string, Buffer>();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => {
      if (!req.headers.authorization?.startsWith("AWS4-HMAC-SHA256")) {
        res.writeHead(403);
        res.end("unsigned");
        return;
      }
      const key = decodeURIComponent(url.pathname.replace(/^\/bucket\//, ""));
      if (req.method === "PUT") {
        objects.set(key, Buffer.concat(chunks));
        res.writeHead(200, { etag: '"1"' });
        res.end();
        return;
      }
      if (req.method === "GET") {
        const body = objects.get(key);
        if (!body) {
          res.writeHead(404);
          res.end("missing");
          return;
        }
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(body);
        return;
      }
      if (req.method === "DELETE") {
        objects.delete(key);
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(405);
      res.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const provider = createS3Provider({
      endpoint: `http://127.0.0.1:${port}`,
      region: "us-east-1",
      bucket: "bucket",
      accessKeyId: "AKIAtest",
      secretAccessKey: "secretsecretsecretsecretsecret12",
      pathStyle: true,
    });
    const put = await provider.put({ key: "folder/note.txt", body: new TextEncoder().encode("stored"), contentType: "text/plain" });
    assert.equal(put.ok, true);
    const got = await provider.get("folder/note.txt");
    assert.equal(got.ok, true);
    if (got.ok) assert.equal(new TextDecoder().decode(got.body), "stored");
  } finally {
    server.close();
  }
});
