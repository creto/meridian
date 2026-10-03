import assert from "node:assert/strict";
import test from "node:test";
import { advanceServices } from "./workflow-run.ts";
import type { FormDefinition, Submission } from "./types.ts";

function httpForm(url: string): FormDefinition {
  return {
    id: "form_ssrf",
    name: "ssrf-check",
    title: "SSRF check",
    description: "",
    display: "form",
    status: "published",
    version: 1,
    hasUnpublishedChanges: false,
    components: [],
    settings: { submitLabel: "Submit", draftLabel: "Save", successMessage: "ok", allowDraft: true },
    workflow: {
      nodes: [
        { id: "start", type: "start", title: "Start" },
        { id: "call", type: "http", title: "Call", url, service: "http" },
        { id: "end", type: "end", title: "Done" },
      ],
      edges: [
        { from: "start", to: "call" },
        { from: "call", to: "end", when: "approved" },
      ],
    },
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [],
    activity: [],
    pdfPages: 1,
  };
}

test("advanceServices blocks metadata and private destinations at runtime", async () => {
  const original = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  try {
    const form = httpForm("http://169.254.169.254/latest/meta-data");
    const submission: Submission = {
      id: "sub_ssrf",
      formId: form.id,
      formName: form.name,
      formVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "in_review",
      data: {},
      revisions: [],
      documents: [],
      workflow: { currentNode: "call", history: [] },
    };
    const next = await advanceServices(form, submission, "tester");
    assert.equal(called, 0);
    assert.equal(next.workflow?.currentNode, "call");
    const fail = next.workflow?.history.find((event) => event.action === "http-failed");
    assert.ok(fail?.note);
    assert.match(String(fail?.note), /blocked|Private|metadata|link-local/i);
  } finally {
    globalThis.fetch = original;
  }
});

test("advanceServices allows a public https destination through the gate", async () => {
  const original = globalThis.fetch;
  let called = 0;
  let seen: string | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    called += 1;
    seen = String(input);
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  try {
    const form = httpForm("https://example.com/hooks/meridian");
    const submission: Submission = {
      id: "sub_ok",
      formId: form.id,
      formName: form.name,
      formVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "in_review",
      data: {},
      revisions: [],
      documents: [],
      workflow: { currentNode: "call", history: [] },
    };
    const next = await advanceServices(form, submission, "tester");
    assert.equal(called, 1);
    assert.equal(seen, "https://example.com/hooks/meridian");
    assert.equal(next.workflow?.history.some((event) => event.action === "http-called"), true);
    assert.equal(next.workflow?.currentNode, "end");
  } finally {
    globalThis.fetch = original;
  }
});

test("advanceServices rejects a 302 toward loopback or metadata without following it", async () => {
  const original = globalThis.fetch;
  const hops = ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data"];
  try {
    for (const evil of hops) {
      const seen: string[] = [];
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const href = String(input);
        seen.push(href);
        if (init?.redirect !== "manual") {
          seen.push(evil);
          return new Response("leaked", { status: 200 });
        }
        return new Response(null, { status: 302, headers: { location: evil } });
      }) as typeof fetch;
      const form = httpForm("https://example.com/hooks/meridian");
      const submission: Submission = {
        id: "sub_redir",
        formId: form.id,
        formName: form.name,
        formVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "in_review",
        data: {},
        revisions: [],
        documents: [],
        workflow: { currentNode: "call", history: [] },
      };
      const next = await advanceServices(form, submission, "tester");
      assert.deepEqual(seen, ["https://example.com/hooks/meridian"]);
      assert.equal(next.workflow?.currentNode, "call");
      const fail = next.workflow?.history.find((event) => event.action === "http-failed");
      assert.match(String(fail?.note), /blocked|Private|link-local|metadata/i);
    }
  } finally {
    globalThis.fetch = original;
  }
});
