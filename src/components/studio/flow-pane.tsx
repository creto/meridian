import { useState } from "react";
import { Button, Input } from "@/components/ui/primitives";
import { uniqueKey } from "@/lib/forms/ids";
import type { FormDefinition, WorkflowDef, WorkflowNode, WorkflowNodeType } from "@/lib/forms/types";
import { traceWorkflow, validateWorkflow } from "@/lib/workflow/graph";

const ADDABLE: WorkflowNodeType[] = ["human", "approval", "decision", "service", "timer", "http", "end"];

function blank(type: WorkflowNodeType, id: string, title: string): WorkflowNode {
  if (type === "service") return { id, type, title: title || "Store document", service: "archive" };
  if (type === "timer") return { id, type, title: title || "Wait", delayMs: 60000 };
  if (type === "http") return { id, type, title: title || "Call service", url: "https://example.com/hook" };
  if (type === "approval" || type === "human") return { id, type, title: title || "Review", role: "Reviewer" };
  if (type === "end") return { id, type, title: title || "Done" };
  return { id, type, title: title || "Decision" };
}

const STARTER: WorkflowDef = {
  nodes: [
    { id: "start", type: "start", title: "Submitted" },
    { id: "review", type: "human", title: "Review", role: "Reviewer" },
    { id: "done", type: "end", title: "Approved" },
    { id: "rejected", type: "end", title: "Rejected" },
  ],
  edges: [
    { from: "start", to: "review", when: "approved" },
    { from: "review", to: "done", when: "approved" },
    { from: "review", to: "rejected", when: "rejected" },
  ],
};

export function FlowPane({ form, onChange }: { form: FormDefinition; onChange: (workflow: FormDefinition["workflow"]) => void }) {
  const flow = form.workflow;
  const [selected, setSelected] = useState("review");
  const [title, setTitle] = useState("Review");
  const [kind, setKind] = useState<WorkflowNodeType>("human");
  const [outcome, setOutcome] = useState<"approved" | "rejected">("approved");
  if (!flow) {
    return (
      <div className="grid gap-3 bg-paper p-6 text-paper-fg">
        <p className="max-w-xl text-sm text-muted">No workflow yet. A workflow starts after submit. It is separate from the pages a person clicks through.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onChange(STARTER)}>Start with review</Button>
          <Button variant="secondary" onClick={() => onChange({
            nodes: [
              { id: "start", type: "start", title: "Submitted" },
              { id: "pdf", type: "service", title: "Build PDF", service: "pdf" },
              { id: "done", type: "end", title: "Filed" },
            ],
            edges: [{ from: "start", to: "pdf" }, { from: "pdf", to: "done" }],
          })}>Start with PDF</Button>
        </div>
      </div>
    );
  }
  const issues = validateWorkflow(flow);
  const node = flow.nodes.find((item) => item.id === selected) ?? flow.nodes[0];
  const path = traceWorkflow(flow, outcome);

  function save(next: WorkflowDef) {
    onChange(next);
  }

  function updateNode(patch: Partial<WorkflowNode>) {
    if (!node) return;
    save({ ...flow!, nodes: flow!.nodes.map((item) => item.id === node.id ? { ...item, ...patch } : item) });
  }

  return (
    <div className="grid min-h-0 flex-1 bg-paper text-paper-fg lg:grid-cols-[18rem_1fr]">
      <aside className="grid content-start gap-2 overflow-auto border-r border-line p-3">
        <h2 className="text-sm font-semibold">Steps</h2>
        {flow.nodes.map((item) => (
          <button key={item.id} type="button" className={`rounded-lg border px-3 py-2 text-left ${node?.id === item.id ? "border-accent bg-surface" : "border-line"}`} onClick={() => setSelected(item.id)}>
            <span className="text-xs text-muted">{item.type}{path.includes(item.id) ? " · on this path" : ""}</span>
            <span className="block text-sm font-medium">{item.title}</span>
          </button>
        ))}
        <div className="mt-2 grid gap-2">
          <Input aria-label="New step title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <select aria-label="New step type" className="h-11 rounded-md border border-line bg-elevated px-2 text-sm" value={kind} onChange={(event) => setKind(event.target.value as WorkflowNodeType)}>
            {ADDABLE.map((item) => <option key={item}>{item}</option>)}
          </select>
          <Button onClick={() => {
            const id = uniqueKey(title || kind, new Set(flow.nodes.map((item) => item.id)));
            const created = blank(kind, id, title);
            const last = [...flow.nodes].reverse().find((item) => item.type !== "end") ?? flow.nodes[0];
            save({ nodes: [...flow.nodes, created], edges: last ? [...flow.edges, { from: last.id, to: id, when: kind === "end" ? outcome : "approved" }] : flow.edges });
            setSelected(id);
          }}>Add step</Button>
        </div>
      </aside>
      <div className="grid content-start gap-4 overflow-auto p-4">
        <section className="grid gap-2">
          <h2 className="font-semibold">Checks</h2>
          {issues.length === 0 ? <p className="text-sm text-muted">The graph is reachable and has one start.</p> : (
            <ul className="grid gap-1 text-sm text-danger">{issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>
          )}
          <label className="flex items-center gap-2 text-sm">Trace
            <select aria-label="Trace outcome" className="h-11 rounded-md border border-line bg-elevated px-2" value={outcome} onChange={(event) => setOutcome(event.target.value as "approved" | "rejected")}>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          <p className="text-sm">{path.map((id) => flow.nodes.find((item) => item.id === id)?.title ?? id).join(" → ") || "No path"}</p>
        </section>
        {node ? (
          <section className="grid max-w-xl gap-2">
            <h2 className="font-semibold">{node.title}</h2>
            <label className="grid gap-1 text-sm">Title
              <Input aria-label="Step title" value={node.title} onChange={(event) => updateNode({ title: event.target.value })} />
            </label>
            {node.type === "human" || node.type === "approval" ? (
              <label className="grid gap-1 text-sm">Role
                <Input aria-label="Role" value={node.role ?? ""} onChange={(event) => updateNode({ role: event.target.value })} />
              </label>
            ) : null}
            {node.type === "service" ? (
              <label className="grid gap-1 text-sm">Service
                <select aria-label="Service" className="h-11 rounded-md border border-line bg-elevated px-2" value={node.service ?? "archive"} onChange={(event) => updateNode({ service: event.target.value as WorkflowNode["service"] })}>
                  {["pdf", "archive", "storage", "email", "ecm", "webhook", "ai"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            ) : null}
            {node.type === "http" || node.type === "webhook" || node.service === "webhook" ? (
              <label className="grid gap-1 text-sm">URL
                <Input aria-label="URL" value={node.url ?? ""} onChange={(event) => updateNode({ url: event.target.value })} />
              </label>
            ) : null}
            {node.type === "timer" ? (
              <label className="grid gap-1 text-sm">Delay (ms)
                <Input aria-label="Delay" type="number" value={node.delayMs ?? 0} onChange={(event) => updateNode({ delayMs: Number(event.target.value) || 0 })} />
              </label>
            ) : null}
            {node.type === "service" && node.service === "email" ? (
              <label className="grid gap-1 text-sm">Email template
                <Input aria-label="Email template" value={node.emailTemplate ?? ""} onChange={(event) => updateNode({ emailTemplate: event.target.value })} />
              </label>
            ) : null}
            <Button variant="danger" disabled={node.type === "start"} onClick={() => {
              save({
                nodes: flow.nodes.filter((item) => item.id !== node.id),
                edges: flow.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id),
              });
              setSelected(flow.nodes.find((item) => item.id !== node.id)?.id ?? "");
            }}>Delete step</Button>
          </section>
        ) : null}
        <section className="grid gap-2">
          <h2 className="font-semibold">Edges</h2>
          {flow.edges.map((edge, index) => (
            <div key={`${edge.from}-${edge.to}-${index}`} className="grid gap-2 rounded-md border border-line p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <select aria-label="From" className="h-11 rounded-md border border-line bg-elevated px-2 text-sm" value={edge.from} onChange={(event) => save({ ...flow, edges: flow.edges.map((item, at) => at === index ? { ...item, from: event.target.value } : item) })}>
                {flow.nodes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <select aria-label="To" className="h-11 rounded-md border border-line bg-elevated px-2 text-sm" value={edge.to} onChange={(event) => save({ ...flow, edges: flow.edges.map((item, at) => at === index ? { ...item, to: event.target.value } : item) })}>
                {flow.nodes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <Input aria-label="When" value={edge.when ?? ""} placeholder="approved" onChange={(event) => save({ ...flow, edges: flow.edges.map((item, at) => at === index ? { ...item, when: event.target.value } : item) })} />
              <Button variant="ghost" onClick={() => save({ ...flow, edges: flow.edges.filter((_, at) => at !== index) })}>Remove</Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => {
            const from = flow.nodes[0]?.id ?? "start";
            const to = flow.nodes.at(-1)?.id ?? from;
            save({ ...flow, edges: [...flow.edges, { from, to, when: "approved" }] });
          }}>Add edge</Button>
        </section>
      </div>
    </div>
  );
}
