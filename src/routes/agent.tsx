import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/shell";
import { Button, Input, Textarea } from "@/components/ui/primitives";
import { validateForm } from "@/lib/forms/engine";
import { toCapabilities, toJsonSchema, toToolDefinition } from "@/lib/forms/schema-export";
import { useFormStore } from "@/lib/forms/store";

export const Route = createFileRoute("/agent")({ component: AgentPage });

function AgentPage() {
  const allForms = useFormStore((s) => s.forms);
  const forms = useMemo(() => allForms.filter((form) => form.status !== "archived"), [allForms]);
  const submit = useFormStore((s) => s.submit);
  const [formId, setFormId] = useState(forms[0]?.id ?? "");
  const [payload, setPayload] = useState('{\n  "legalName": "Acme SAS",\n  "supplierType": "colombian_company",\n  "country": "CO",\n  "nit": "900123456-1",\n  "repName": "Ana Perez",\n  "repEmail": "ana@acme.example",\n  "paymentMethod": "check"\n}');
  const [key, setKey] = useState("agent-demo-1");
  const [out, setOut] = useState("");
  const form = forms.find((item) => item.id === formId) ?? forms[0];
  const schema = useMemo(() => (form ? toJsonSchema(form) : null), [form]);
  const caps = useMemo(() => (form ? toCapabilities(form) : null), [form]);
  const tool = useMemo(() => (form ? toToolDefinition(form) : null), [form]);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Agent console</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Discover a form, read its input schema, validate an object, and submit it. Idempotency keys stop a retry from creating a second record. Agents use the same rules as the form — they do not skip them.
          </p>
        </div>
        <label className="grid max-w-md gap-1 text-sm">
          Form
          <select className="h-11 rounded-md border border-line bg-elevated px-3" value={form?.id ?? ""} onChange={(e) => setFormId(e.target.value)}>
            {forms.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        {form && schema && caps && tool ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section>
              <h2 className="mb-2 font-semibold">Capabilities</h2>
              <pre className="max-h-72 overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{JSON.stringify(caps, null, 2)}</pre>
            </section>
            <section>
              <h2 className="mb-2 font-semibold">Tool definition</h2>
              <pre className="max-h-72 overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{JSON.stringify(tool, null, 2)}</pre>
            </section>
            <section className="lg:col-span-2">
              <h2 className="mb-2 font-semibold">Submit object</h2>
              <p className="mb-2 font-mono text-xs text-muted">POST /agent/v1/forms/{form.name}/submit-object</p>
              <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} className="min-h-48 font-mono text-xs" aria-label="Object" />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input className="max-w-xs" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Idempotency key" />
                <Button variant="secondary" onClick={() => {
                  try {
                    const data = JSON.parse(payload) as Record<string, unknown>;
                    const errors = validateForm(form, data);
                    setOut(JSON.stringify({ ok: Object.keys(errors).length === 0, errors }, null, 2));
                  } catch (error) {
                    setOut(error instanceof Error ? error.message : "Invalid JSON");
                  }
                }}>Validate</Button>
                <Button onClick={() => {
                  void (async () => {
                    try {
                      const data = JSON.parse(payload) as Record<string, unknown>;
                      const response = await submit({ formId: form.id, data, actor: "agent", source: "agent", idempotencyKey: key || undefined });
                      setOut(JSON.stringify(response.ok
                        ? { submissionId: response.submission?.id, status: response.submission?.status, workflowInstanceId: response.submission?.workflow ? response.submission.id : null, workflow: response.submission?.workflow }
                        : { error: { code: response.code, message: response.message, details: response.errors } }, null, 2));
                    } catch (error) {
                      setOut(error instanceof Error ? error.message : "Invalid JSON");
                    }
                  })();
                }}>Submit</Button>
              </div>
              {out ? <pre className="mt-3 overflow-auto rounded-xl border border-line p-3 font-mono text-xs">{out}</pre> : null}
            </section>
          </div>
        ) : <p className="text-sm text-muted">Create a form first.</p>}
      </main>
    </div>
  );
}
