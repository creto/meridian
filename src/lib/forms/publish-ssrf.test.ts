import assert from "node:assert/strict";
import test from "node:test";
import { useFormStore } from "./store.ts";
import type { FormDefinition } from "./types.ts";

function draftWithHttp(url: string, id: string): FormDefinition {
  const now = new Date().toISOString();
  return {
    id,
    name: `publish-ssrf-${id}`,
    title: "Publish SSRF check",
    description: "",
    display: "form",
    status: "draft",
    version: 0,
    hasUnpublishedChanges: true,
    components: [{ id: "cmp_name", type: "textfield", key: "name", label: "Name" }],
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
    createdAt: now,
    updatedAt: now,
    versions: [],
    activity: [],
    pdfPages: 1,
  };
}

test("publishForm refuses private and metadata workflow URLs", () => {
  useFormStore.getState().setRole("owner");
  for (const url of ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data"]) {
    const form = draftWithHttp(url, `frm_bad_${url.includes("127") ? "loop" : "meta"}`);
    useFormStore.getState().addForm(form);
    const result = useFormStore.getState().publishForm(form.id, "should fail");
    assert.equal(result.ok, false, url);
    assert.ok(result.issues.some((issue) => issue.code === "SSRF"), url);
    assert.ok(result.issues.some((issue) => issue.level === "error"), url);
    const published = useFormStore.getState().forms.find((item) => item.id === form.id);
    assert.notEqual(published?.status, "published", url);
  }
});

test("publishForm allows a public https workflow URL", () => {
  useFormStore.getState().setRole("owner");
  const form = draftWithHttp("https://example.com/hooks/meridian", "frm_ok_https");
  useFormStore.getState().addForm(form);
  const result = useFormStore.getState().publishForm(form.id, "should pass");
  assert.equal(result.ok, true);
  assert.equal(result.issues.some((issue) => issue.code === "SSRF"), false);
  const published = useFormStore.getState().forms.find((item) => item.id === form.id);
  assert.equal(published?.status, "published");
});
