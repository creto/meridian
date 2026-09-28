import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/shell";
import { Button, Textarea } from "@/components/ui/primitives";
import { formatValue } from "@/lib/forms/pdf";
import { inputLabels } from "@/lib/forms/schema-export";
import { useFormStore } from "@/lib/forms/store";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const submissions = useFormStore((s) => s.submissions);
  const forms = useFormStore((s) => s.forms);
  const act = useFormStore((s) => s.workflowAction);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(submissions.find((s) => s.status === "in_review")?.id ?? null);
  const tasks = submissions.filter((item) => item.status === "in_review" || item.status === "changes_requested");
  const current = submissions.find((item) => item.id === open) ?? tasks[0];
  const form = forms.find((item) => item.id === current?.formId);
  const node = form?.workflow?.nodes.find((item) => item.id === current?.workflow?.currentNode);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[18rem_1fr]">
        <aside className="grid content-start gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          {tasks.length === 0 ? <p className="text-sm text-muted">Nothing is waiting.</p> : null}
          {tasks.map((task) => (
            <button key={task.id} type="button" className={`rounded-lg border px-3 py-3 text-left ${current?.id === task.id ? "border-accent bg-surface" : "border-line"}`} onClick={() => setOpen(task.id)}>
              <span className="block text-sm font-medium">{String(task.data.legalName || task.data.subject || task.id)}</span>
              <span className="text-xs text-muted">{task.status.replaceAll("_", " ")}</span>
            </button>
          ))}
        </aside>
        {current && form ? (
          <section className="rounded-xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">{form.title}</p>
            <h2 className="text-xl font-semibold">{node?.title ?? current.status}</h2>
            {node?.role ? <p className="text-sm text-muted">Role · {node.role}</p> : null}
            <dl className="mt-4 grid gap-2">
              {inputLabels(form).map((field) => (
                <div key={field.key} className="grid grid-cols-1 gap-1 border-t border-line py-2 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-sm text-muted">{field.label}</dt>
                  <dd className="text-sm break-words">{formatValue(current.data[field.key])}</dd>
                </div>
              ))}
            </dl>
            <Textarea className="mt-4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the record" aria-label="Decision note" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => { void act(current.id, "approve", note).then((result) => { if (result && !result.ok) toast.error(result.message || "The step did not complete"); else toast.success("Recorded"); setNote(""); }); }}>Approve</Button>
              <Button variant="secondary" onClick={() => { void act(current.id, "changes", note); toast.success("Sent back"); }}>Request changes</Button>
              <Button variant="danger" onClick={() => { void act(current.id, "reject", note); toast.success("Rejected"); }}>Reject</Button>
              <Link to="/fill/$formId" params={{ formId: form.id }} className="inline-flex h-11 items-center px-2 text-sm underline">Open form</Link>
            </div>
            <h3 className="mt-6 text-sm font-medium">History</h3>
            <ul className="mt-2 grid gap-1 text-sm text-muted">
              {current.workflow?.history.map((event, index) => (
                <li key={index}>{new Date(event.at).toLocaleString()} — {event.actor} {event.action}{event.note ? ` · ${event.note}` : ""}</li>
              ))}
            </ul>
            {current.documents.length ? (
              <p className="mt-4 font-mono text-xs text-muted">Archive {current.documents[0]?.sha256}</p>
            ) : null}
          </section>
        ) : (
          <p className="text-sm text-muted">Select a task.</p>
        )}
      </main>
    </div>
  );
}
