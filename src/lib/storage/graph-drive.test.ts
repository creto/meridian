import assert from "node:assert/strict";
import test from "node:test";
import { createGraphDrive } from "./graph-drive.ts";

test("Graph drive uploads, searches, and refreshes a rejected token", async () => {
  const files = new Map<string, { id: string; name: string; body: Uint8Array; folder: string }>();
  let tokens = 0;
  let rejectOnce = true;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/oauth2/v2.0/token")) {
      tokens += 1;
      return json({ access_token: `tok_${tokens}`, expires_in: 3600 });
    }
    if (url.startsWith("https://upload.example/session")) {
      return json({ id: "item_big", name: "big.bin", size: (init?.body instanceof Uint8Array ? init.body.byteLength : 0) }, 201);
    }
    if (rejectOnce) {
      rejectOnce = false;
      return new Response("expired", { status: 401 });
    }
    const auth = new Headers(init?.headers).get("authorization");
    assert.match(auth ?? "", /^Bearer tok_/);
    if (url.endsWith("/drives/drive_1") && method === "GET") return json({ name: "Forms" });
    if (url.includes("/root/children") && method === "GET") return json({ value: [{ id: "fld_1", name: "Inbox", folder: {} }] });
    if (url.includes("/children") && method === "POST") return json({ id: "fld_2", name: "2026", folder: {} });
    if (url.includes(":/content") && method === "PUT") {
      const body = init?.body instanceof Uint8Array ? init.body : new Uint8Array();
      files.set("item_1", { id: "item_1", name: "note.txt", body, folder: "/Inbox" });
      return json({ id: "item_1", name: "note.txt", size: body.byteLength, file: { mimeType: "text/plain" } });
    }
    if (url.includes("/items/item_1/content") && method === "GET") {
      const file = files.get("item_1");
      return new Response((file?.body ?? new Uint8Array()) as unknown as BodyInit);
    }
    if (url.includes("/items/item_1/content") && method === "PUT") {
      const body = init?.body instanceof Uint8Array ? init.body : new Uint8Array();
      const file = files.get("item_1");
      if (file) file.body = body;
      return json({ id: "item_1", name: "note.txt", size: body.byteLength });
    }
    if (url.includes("$expand=listItem")) return json({ id: "item_1", name: "note.txt", listItem: { fields: { Status: "Filed" } } });
    if (url.includes("/listItem/fields") && method === "PATCH") return json({});
    if (url.includes("/search")) return json({ value: [{ id: "item_1", name: "note.txt", size: 4, file: {}, parentReference: { path: "/Inbox" } }] });
    if (url.includes("createUploadSession")) return json({ uploadUrl: "https://upload.example/session" });
    if (url.startsWith("https://upload.example/session")) {
      return json({ id: "item_big", name: "big.bin", size: (init?.body instanceof Uint8Array ? init.body.byteLength : 0) }, 201);
    }
    return new Response("not found", { status: 404 });
  };
  const drive = createGraphDrive({
    tenant: "contoso",
    clientId: "app",
    clientSecret: "secret",
    siteId: "site",
    driveId: "drive_1",
    fetchImpl,
    now: () => 1_700_000_000_000,
  });
  const health = await drive.testConnection();
  assert.equal(health.ok, true);
  assert.equal(tokens >= 2, true);
  const folders = await drive.listFolders("/");
  assert.equal(folders[0]?.name, "Inbox");
  const created = await drive.createFolder("/Inbox", "2026");
  assert.equal(created.id, "fld_2");
  const uploaded = await drive.uploadDocument({ folder: "/Inbox", name: "note.txt", body: new TextEncoder().encode("note"), contentType: "text/plain" });
  assert.equal(uploaded.bytes, 4);
  assert.equal(new TextDecoder().decode(await drive.downloadDocument(uploaded.id)), "note");
  const updated = await drive.updateDocument(uploaded.id, new TextEncoder().encode("next"));
  assert.equal(updated.sha256.length, 64);
  assert.equal((await drive.getMetadata(uploaded.id)).Status, "Filed");
  await drive.setMetadata(uploaded.id, { Status: "Filed" });
  const found = await drive.search("note");
  assert.equal(found[0]?.id, "item_1");
  const big = new Uint8Array(5 * 1024 * 1024);
  const large = await drive.uploadDocument({ folder: "/Inbox", name: "big.bin", body: big });
  assert.equal(large.id, "item_big");
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
