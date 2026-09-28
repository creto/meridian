import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Textarea } from "@/components/ui/primitives";
import { validateForm } from "@/lib/forms/engine";
import { sampleSubmission } from "@/lib/forms/pdf-layout";
import { toCapabilities, toJsonSchema, toToolDefinition } from "@/lib/forms/schema-export";
import { useFormStore } from "@/lib/forms/store";
import { downloadBytes } from "@/lib/forms/pdf";
import type { FormDefinition } from "@/lib/forms/types";

function openApi(form: FormDefinition) {
  const schema = toJsonSchema(form);
  return {
    openapi: "3.1.0",
    info: { title: form.title, version: String(form.version) },
    paths: {
      [`/api/agent/v1/forms/${form.name}/validate-object`]: {
        post: {
          operationId: `validate_${form.name}`,
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { data: schema }, required: ["data"] } } } },
          responses: { "200": { description: "Validation result" } },
        },
      },
      [`/api/agent/v1/forms/${form.name}/submit-object`]: {
        post: {
          operationId: `submit_${form.name}`,
          parameters: [{ name: "Idempotency-Key", in: "header", required: false, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { data: schema }, required: ["data"] } } } },
          responses: { "200": { description: "Stored" }, "422": { description: "Invalid" } },
        },
      },
    },
  };
}

export function ApiPane({ form }: { form: FormDefinition }) {
  const submit = useFormStore((s) => s.submit);
  const schema = useMemo(() => toJsonSchema(form), [form]);
  const caps = useMemo(() => toCapabilities(form), [form]);
  const tool = useMemo(() => toToolDefinition(form), [form]);
  const spec = useMemo(() => openApi(form), [form]);
  const [payload, setPayload] = useState(() => JSON.stringify(sampleSubmission(form.components), null, 2));
  const [idempotency, setIdempotency] = useState(`agent_${form.name}`);
  const [result, setResult] = useState("");
  const curl = `curl -X POST ${typeof location !== "undefined" ? location.origin : ""}/api/agent/v1/forms/${form.name}/submit-object \\\n  -H 'content-type: application/json' \\\n  -H 'idempotency-key: ${idempotency}' \\\n  -d '${JSON.stringify({ data: sampleSubmission(form.components) })}'`;

  function readData() {
    const data = JSON.parse(payload) as Record<string, unknown>;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The body must be a JSON object of field keys");
    return data;
  }

  function validateOnly() {
    try {
      const data = readData();
      const errors = validateForm(form, data);
      setResult(JSON.stringify({ ok: Object.keys(errors).length === 0, errors }, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-paper p-4 text-paper-fg">
      <div className="mx-auto grid max-w-4xl gap-4">
        <p className="text-sm text-muted">Validate checks the object in the browser. Submit writes a workspace record. Neither call leaves this app unless you copy the request and run it yourself.</p>
        <section className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Object</h2>
            <Button variant="ghost" onClick={() => setPayload(JSON.stringify(sampleSubmission(form.components), null, 2))}>Fill example</Button>
            <Button variant="secondary" onClick={validateOnly}>Validate</Button>
            <Button onClick={() => {
              void (async () => {
                try {
                  const data = readData();
                  const response = await submit({ formId: form.id, data, actor: "agent", source: "agent", idempotencyKey: idempotency || undefined });
                  setResult(JSON.stringify(response.ok ? { submissionId: response.submission?.id, status: response.submission?.status, workflow: response.submission?.workflow } : { error: { code: response.code, message: response.message, details: response.errors } }, null, 2));
                } catch (error) {
                  setResult(error instanceof Error ? error.message : "Invalid JSON");
                }
              })();
            }}>Submit</Button>
          </div>
          <Input aria-label="Idempotency key" value={idempotency} onChange={(event) => setIdempotency(event.target.value)} />
          <Textarea value={payload} onChange={(event) => setPayload(event.target.value)} className="min-h-40 font-mono text-xs" aria-label="Submission object" />
          {result ? <pre className="overflow-auto rounded-xl border border-line p-3 font-mono text-xs">{result}</pre> : null}
        </section>
        <Doc title="cURL" text={curl} filename={`${form.name}.sh`} type="text/plain" />
        <Doc title="OpenAPI" text={JSON.stringify(spec, null, 2)} filename={`${form.name}.openapi.json`} type="application/json" />
        <Doc title="JSON Schema" text={JSON.stringify(schema, null, 2)} filename={`${form.name}.schema.json`} type="application/json" />
        <Doc title="Tool definition" text={JSON.stringify(tool, null, 2)} filename={`${form.name}.tool.json`} type="application/json" />
        <Doc title="Capabilities" text={JSON.stringify(caps, null, 2)} filename={`${form.name}.capabilities.json`} type="application/json" />
      </div>
    </div>
  );
}

function Doc({ title, text, filename, type }: { title: string; text: string; filename: string; type: string }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(text); toast.success(`Copied ${title}`); }}>Copy</Button>
        <Button variant="ghost" onClick={() => downloadBytes(new TextEncoder().encode(text), filename, type)}>Download</Button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{text}</pre>
    </section>
  );
}
