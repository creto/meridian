import assert from "node:assert/strict";
import test from "node:test";
import { createCmisBrowser } from "./cmis-browser.ts";

test("CMIS browser binding lists, uploads, and queries through a fake repository", async () => {
  const files = new Map<string, Uint8Array>();
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (url.pathname === "/cmis/browser" && method === "GET") {
      return json({ repo: { repositoryId: "repo", repositoryName: "Contracts" } });
    }
    assert.equal(url.pathname, "/cmis/browser/repo");
    if (method === "GET" && url.searchParams.get("cmisselector") === "children") {
      return json({ objects: [{ object: { succinctProperties: { "cmis:baseTypeId": "cmis:folder", "cmis:objectId": "fld", "cmis:name": "Inbox" } } }] });
    }
    if (method === "GET" && url.searchParams.get("cmisselector") === "content") {
      const body = files.get(url.searchParams.get("objectId") ?? "") ?? new Uint8Array();
      return new Response(body as unknown as BodyInit);
    }
    if (method === "GET" && url.searchParams.get("cmisselector") === "object") {
      return json({ succinctProperties: { "cmis:objectId": "doc1", "cmis:name": "a.pdf", "cmis:contentStreamLength": 4 } });
    }
    if (method === "GET" && url.searchParams.get("cmisselector") === "query") {
      assert.match(url.searchParams.get("q") ?? "", /CONTAINS\('ada''s'\)/);
      return json({ results: [{ object: { succinctProperties: { "cmis:objectId": "doc1", "cmis:name": "a.pdf", "cmis:path": "/Inbox/a.pdf", "cmis:contentStreamLength": 4 } } }] });
    }
    if (method === "POST") {
      const form = init?.body;
      if (form instanceof URLSearchParams && form.get("cmisaction") === "createFolder") return json({ succinctProperties: { "cmis:objectId": "fld2" } });
      if (form instanceof URLSearchParams && form.get("cmisaction") === "updateProperties") return json({ succinctProperties: {} });
      if (form instanceof FormData && form.get("cmisaction") === "createDocument") {
        files.set("doc1", new TextEncoder().encode("file"));
        return json({ succinctProperties: { "cmis:objectId": "doc1", "cmis:name": "a.pdf" } });
      }
      if (form instanceof FormData && form.get("cmisaction") === "setContent") {
        files.set("doc1", new TextEncoder().encode("next"));
        return json({ succinctProperties: { "cmis:name": "a.pdf", "cmis:path": "/Inbox/a.pdf" } });
      }
    }
    return new Response("no", { status: 404 });
  };
  const cmis = createCmisBrowser({ browserUrl: "https://ecm.example/cmis/browser", repositoryId: "repo", username: "ada", password: "secret", fetchImpl });
  assert.equal((await cmis.testConnection()).ok, true);
  assert.equal((await cmis.listFolders("/"))[0]?.name, "Inbox");
  assert.equal((await cmis.createFolder("/", "2026")).id, "fld2");
  const uploaded = await cmis.uploadDocument({ folder: "/", name: "a.pdf", body: new TextEncoder().encode("file") });
  assert.equal(uploaded.id, "doc1");
  assert.equal(new TextDecoder().decode(await cmis.downloadDocument("doc1")), "file");
  const updated = await cmis.updateDocument("doc1", new TextEncoder().encode("next"));
  assert.equal(updated.bytes, 4);
  assert.equal((await cmis.getMetadata("doc1"))["cmis:name"], "a.pdf");
  await cmis.setMetadata("doc1", { "meridian:status": "filed" });
  const found = await cmis.search("ada's");
  assert.equal(found[0]?.folder, "/Inbox/a.pdf");
  assert.throws(() => createCmisBrowser({ browserUrl: "http://127.0.0.1/cmis", repositoryId: "repo" }));
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}
