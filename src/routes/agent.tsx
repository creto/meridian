import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/shell";
import { Button, Input, Textarea } from "@/components/ui/primitives";
import { agentChat, type ChatTurn } from "@/lib/forms/ai.functions";
import { validateForm } from "@/lib/forms/engine";
import { proposalFromModel, resolveForm } from "@/lib/forms/llm";
import { flattenInputs } from "@/lib/forms/tree";
import { toCapabilities, toJsonSchema, toToolDefinition } from "@/lib/forms/schema-export";
import { useFormStore } from "@/lib/forms/store";

export const Route = createFileRoute("/agent")({ component: AgentPage });

const STARTERS = [
  "What is required on the supplier form, and when do those fields appear?",
  "Design a visitor badge form with name, company, host, visit date, and a photo. Keep it to one page.",
  "Diseña un permiso de trabajo en altura: nombre, cuadrilla, fecha, y un checklist de arnés. Que el supervisor lo apruebe.",
  "File a supplier registration for Andes Millworks SAS, a Colombian company, NIT 900123456-1, country CO, representative Ana Perez, email ana@andes.example, paying by check. Submit it.",
];

interface Receipt {
  title: string;
  detail: string;
  formId?: string;
}

interface Bubble {
  role: "user" | "assistant";
  content: string;
  transcript: string;
  provider?: "grok" | "local";
  receipts: Receipt[];
}

function AgentPage() {
  const allForms = useFormStore((s) => s.forms);
  const forms = useMemo(() => allForms.filter((form) => form.status !== "archived"), [allForms]);
  const addForm = useFormStore((s) => s.addForm);
  const updateForm = useFormStore((s) => s.updateForm);
  const submit = useFormStore((s) => s.submit);
  const [formId, setFormId] = useState(forms[0]?.id ?? "");
  const [payload, setPayload] = useState('{\n  "legalName": "Acme SAS",\n  "supplierType": "colombian_company",\n  "country": "CO",\n  "nit": "900123456-1",\n  "repName": "Ana Perez",\n  "repEmail": "ana@acme.example",\n  "paymentMethod": "check"\n}');
  const [key, setKey] = useState("agent-demo-1");
  const [out, setOut] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const contract = forms.find((item) => item.id === formId) ?? forms[0];
  const schema = useMemo(() => (contract ? toJsonSchema(contract) : null), [contract]);
  const caps = useMemo(() => (contract ? toCapabilities(contract) : null), [contract]);
  const tool = useMemo(() => (contract ? toToolDefinition(contract) : null), [contract]);

  const send = async (text: string) => {
    const content = text.trim();
    if (content.length < 2 || busy) return;
    const history: ChatTurn[] = [...messages.map((item) => ({ role: item.role, content: item.transcript })), { role: "user" as const, content }];
    setMessages((curr) => [...curr, { role: "user", content, transcript: content, receipts: [] }]);
    setDraft("");
    setBusy(true);
    try {
      const result = await agentChat({ data: { messages: history, forms } });
      if (!result.ok) {
        setMessages((curr) => [...curr, { role: "assistant", content: result.error, transcript: result.error, receipts: [] }]);
        return;
      }
      const receipts: Receipt[] = [];
      const notes: string[] = [];
      let working = useFormStore.getState().forms;
      for (const action of result.actions) {
        if (action.type === "create_form") {
          addForm(action.form);
          working = [action.form, ...working];
          const fields = flattenInputs(action.form.components).slice(0, 10).map((field) => field.label).join(", ");
          receipts.push({ title: "Saved in the builder", detail: fields ? `${action.form.title}\n${fields}` : action.form.title, formId: action.form.id });
          notes.push(`Created form ${action.form.title} (${action.form.id}) with fields: ${fields}.`);
          continue;
        }
        if (action.type === "edit_form") {
          const target = resolveForm(working, action.formId);
          if (!target) {
            receipts.push({ title: "Form not found", detail: action.formId });
            notes.push(`Could not find form ${action.formId}.`);
            continue;
          }
          const proposal = proposalFromModel(target, action);
          if (!proposal.valid) {
            receipts.push({ title: "No change", detail: proposal.issues.join(" ") || proposal.reply });
            notes.push(`Edit of ${target.title} made no change. ${proposal.issues.join(" ")}`);
            continue;
          }
          updateForm(target.id, (current) => ({
            ...current,
            title: proposal.title,
            description: proposal.description,
            display: proposal.display,
            components: proposal.components,
            workflow: proposal.workflow ?? current.workflow,
          }), proposal.summary[0] ?? "Updated by the agent");
          working = working.map((form) => (form.id === target.id ? { ...form, title: proposal.title, description: proposal.description, display: proposal.display, components: proposal.components, workflow: proposal.workflow ?? form.workflow } : form));
          receipts.push({ title: "Saved in the builder", detail: `${target.title}: ${proposal.summary.join("; ") || proposal.reply}`, formId: target.id });
          notes.push(`Updated ${target.title}. ${proposal.summary.join("; ")}`);
          continue;
        }
        const target = resolveForm(working, action.formId);
        if (!target) {
          receipts.push({ title: "Form not found", detail: action.formId });
          notes.push(`Could not find form ${action.formId}.`);
          continue;
        }
        if (action.type === "validate") {
          const errors = validateForm(target, action.data);
          const ok = Object.keys(errors).length === 0;
          receipts.push({ title: ok ? "Valid" : "Needs attention", detail: ok ? "The object passes the form rules." : Object.entries(errors).map(([field, message]) => `${field}: ${message}`).join("\n") });
          notes.push(ok ? `Validation of ${target.title} passed.` : `Validation of ${target.title} failed: ${JSON.stringify(errors)}`);
          continue;
        }
        const response = await submit({
          formId: target.id,
          data: action.data,
          actor: "agent",
          source: "agent",
          idempotencyKey: action.idempotencyKey || `agent_${target.name}_${Date.now().toString(36)}`,
        });
        if (!response.ok) {
          const detail = response.errors ? Object.entries(response.errors).map(([field, message]) => `${field}: ${message}`).join("\n") : response.message ?? "Not accepted";
          receipts.push({ title: "Not submitted", detail });
          notes.push(`Submit failed (${response.code ?? "error"}): ${detail}`);
        } else {
          receipts.push({ title: "Submitted", detail: `${response.submission?.id} · ${response.submission?.status}` });
          notes.push(`Submitted ${response.submission?.id} on ${target.title} with status ${response.submission?.status}.`);
        }
      }
      const transcript = [result.reply, notes.length ? `Applied:\n${notes.join("\n")}` : ""].filter(Boolean).join("\n\n");
      setMessages((curr) => [...curr, { role: "assistant", content: result.reply, transcript, provider: result.provider, receipts }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The agent didn't answer";
      setMessages((curr) => [...curr, { role: "assistant", content: message, transcript: message, receipts: [] }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="grid content-start gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Agent</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Talk the way you would to a colleague. Grok can explain a form, design a new one, change one that already exists, or file a submission when you explicitly ask it to. A repeated request does not create a second record.
            </p>
          </div>
          <div className="flex min-h-[32rem] flex-col rounded-xl border border-line bg-surface">
            <div className="flex flex-1 flex-col gap-4 overflow-auto p-4" role="log" aria-live="polite">
              {messages.length === 0 ? (
                <div className="grid gap-3">
                  <p className="text-sm text-muted">Try one of these, or write your own.</p>
                  <div className="grid gap-2">
                    {STARTERS.map((item) => (
                      <button key={item} type="button" className="rounded-lg border border-line px-3 py-3 text-left text-sm hover:bg-paper" onClick={() => setDraft(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {messages.map((message, index) => (
                <article key={index} className={message.role === "user" ? "ml-8 rounded-lg bg-chrome px-3 py-3 text-sm text-chrome-fg" : "mr-8 grid gap-2"}>
                  {message.role === "assistant" ? <p className="text-xs text-subtle">{message.provider === "local" ? "On-device" : "Grok"}</p> : null}
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  {message.receipts.map((receipt) => (
                    <div key={receipt.title + receipt.detail} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                      <p className="font-medium">{receipt.title}</p>
                      <p className="whitespace-pre-wrap text-muted">{receipt.detail}</p>
                      {receipt.formId ? <Link to="/studio/$formId" params={{ formId: receipt.formId }} className="mt-1 inline-flex text-sm underline">Open in the builder</Link> : null}
                    </div>
                  ))}
                </article>
              ))}
              {busy ? <p className="text-sm text-muted">Grok is reading the workspace…</p> : null}
            </div>
            <form
              className="grid gap-2 border-t border-line p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft);
              }}
            >
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Design a form, change one, or file a submission"
                aria-label="Message"
                className="min-h-24"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={busy || draft.trim().length < 2}>{busy ? "Working…" : "Send"}</Button>
              </div>
            </form>
          </div>
        </section>
        <aside className="grid content-start gap-4">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="font-semibold">Forms in view</h2>
            <ul className="mt-3 grid gap-2">
              {forms.map((form) => (
                <li key={form.id} className="text-sm">
                  <Link to="/studio/$formId" params={{ formId: form.id }} className="font-medium underline">{form.title}</Link>
                  <p className="text-xs text-muted">{form.status} · {form.display}</p>
                </li>
              ))}
            </ul>
          </section>
          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">API contract</summary>
            {contract && schema && caps && tool ? (
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm">
                  Form
                  <select className="h-11 rounded-md border border-line bg-elevated px-3" value={contract.id} onChange={(event) => setFormId(event.target.value)}>
                    {forms.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
                <pre className="max-h-40 overflow-auto rounded-lg bg-chrome p-3 font-mono text-xs text-chrome-fg">{JSON.stringify(caps, null, 2)}</pre>
                <pre className="max-h-40 overflow-auto rounded-lg bg-chrome p-3 font-mono text-xs text-chrome-fg">{JSON.stringify(tool, null, 2)}</pre>
                <p className="font-mono text-xs text-muted">POST /agent/v1/forms/{contract.name}/submit-object</p>
                <Textarea value={payload} onChange={(event) => setPayload(event.target.value)} className="min-h-36 font-mono text-xs" aria-label="Object" />
                <Input value={key} onChange={(event) => setKey(event.target.value)} aria-label="Idempotency key" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => {
                    try {
                      const data = JSON.parse(payload) as Record<string, unknown>;
                      const errors = validateForm(contract, data);
                      setOut(JSON.stringify({ ok: Object.keys(errors).length === 0, errors }, null, 2));
                    } catch (error) {
                      setOut(error instanceof Error ? error.message : "Invalid JSON");
                    }
                  }}>Validate</Button>
                  <Button onClick={() => {
                    void (async () => {
                      try {
                        const data = JSON.parse(payload) as Record<string, unknown>;
                        const response = await submit({ formId: contract.id, data, actor: "agent", source: "agent", idempotencyKey: key || undefined });
                        setOut(JSON.stringify(response.ok
                          ? { submissionId: response.submission?.id, status: response.submission?.status, workflow: response.submission?.workflow }
                          : { error: { code: response.code, message: response.message, details: response.errors } }, null, 2));
                      } catch (error) {
                        setOut(error instanceof Error ? error.message : "Invalid JSON");
                      }
                    })();
                  }}>Submit</Button>
                </div>
                {out ? <pre className="overflow-auto rounded-lg border border-line p-3 font-mono text-xs">{out}</pre> : null}
                <pre className="max-h-40 overflow-auto rounded-lg bg-chrome p-3 font-mono text-xs text-chrome-fg">{JSON.stringify(schema, null, 2)}</pre>
              </div>
            ) : <p className="mt-3 text-sm text-muted">Create a form first.</p>}
          </details>
        </aside>
      </main>
    </div>
  );
}
