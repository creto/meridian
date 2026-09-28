import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, FieldLabel, Input } from "@/components/ui/primitives";
import type { WorkflowNode, WorkflowNodeType } from "@/lib/forms/types";
import { fitGraph, hitNode, layoutWorkflow } from "@/lib/workflow/layout";
import {
  addNode,
  connect,
  createEditorState,
  disconnect,
  redo,
  removeNode,
  setJoin,
  undo,
  updateNode,
  validateEditor,
  type EditorState,
} from "@/lib/workflow/editor-model";

const PALETTE: Array<{ type: WorkflowNodeType; title: string }> = [
  { type: "human", title: "Human task" },
  { type: "approval", title: "Approval" },
  { type: "decision", title: "Decision" },
  { type: "timer", title: "Timer" },
  { type: "parallel", title: "Parallel split" },
  { type: "join", title: "Join" },
  { type: "http", title: "HTTP" },
  { type: "webhook", title: "Webhook" },
  { type: "service", title: "PDF / ECM / email" },
  { type: "end", title: "End" },
];

export function WorkflowCanvas({ workflowId }: { workflowId: string }) {
  const [state, setState] = useState<EditorState>(() => createEditorState());
  const [selected, setSelected] = useState<string | null>("start");
  const [pan, setPan] = useState({ x: 24, y: 24, scale: 1 });
  const [edgeFrom, setEdgeFrom] = useState<string | null>(null);
  const layout = useMemo(() => layoutWorkflow(state.present), [state.present]);
  const issues = validateEditor(state.present);
  const node = state.present.nodes.find((item) => item.id === selected);

  function apply(result: { ok: boolean; state?: EditorState }) {
    if (result.ok && result.state) setState(result.state);
  }

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] bg-paper">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-3">
        <Link to="/inbox" className="text-sm text-muted">Inbox</Link>
        <h1 className="font-semibold">Workflow {workflowId}</h1>
        <div className="ml-auto flex gap-2">
          <Button aria-label="Undo workflow edit" onClick={() => apply(undo(state))}>Undo</Button>
          <Button aria-label="Redo workflow edit" onClick={() => apply(redo(state))}>Redo</Button>
          <Button aria-label="Fit graph" onClick={() => setPan(fitGraph(layout, { width: 900, height: 640 }))}>Fit</Button>
          <Button aria-label="Zoom in" onClick={() => setPan((current) => ({ ...current, scale: Math.min(2, current.scale + 0.1) }))}>Zoom</Button>
        </div>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px]">
        <aside className="border-r border-line p-3" aria-label="Node palette">
          {PALETTE.map((item) => (
            <button key={item.type} type="button" className="mb-2 block w-full rounded-md border border-line px-2 py-2 text-left text-sm" onClick={() => {
              const id = `${item.type}_${state.present.nodes.length + 1}`;
              const next: WorkflowNode = { id, type: item.type, title: item.title, role: item.type === "human" || item.type === "approval" ? "reviewer" : undefined, delayMs: item.type === "timer" ? 60_000 : undefined, url: item.type === "http" || item.type === "webhook" ? "https://example.com/hook" : undefined, service: item.type === "service" ? "pdf" : undefined };
              apply(addNode(state, next));
              setSelected(id);
            }}>{item.title}</button>
          ))}
        </aside>
        <div
          role="region"
          aria-label="Workflow canvas"
          className="relative overflow-auto bg-[linear-gradient(to_right,#e2dfd6_1px,transparent_1px),linear-gradient(to_bottom,#e2dfd6_1px,transparent_1px)] bg-[size:24px_24px]"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = (event.clientX - rect.left - pan.x) / pan.scale;
            const y = (event.clientY - rect.top - pan.y) / pan.scale;
            const hit = hitNode(layout, x, y);
            setSelected(hit);
            if (hit && edgeFrom && edgeFrom !== hit) {
              apply(connect(state, { from: edgeFrom, to: hit, when: "approved" }));
              setEdgeFrom(null);
            }
          }}
        >
          <svg width={1100} height={720} className="absolute inset-0">
            <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.scale})`}>
              {layout.edges.map((edge) => (
                <g key={`${edge.from}-${edge.to}`}>
                  <polyline fill="none" stroke="#243044" strokeWidth={1.5} points={edge.points.map((point) => `${point.x},${point.y}`).join(" ")} />
                  {edge.label ? <text x={edge.points[1]?.x ?? 0} y={(edge.points[1]?.y ?? 0) - 6} fontSize={11}>{edge.label}</text> : null}
                </g>
              ))}
              {layout.nodes.map((item) => {
                const def = state.present.nodes.find((nodeItem) => nodeItem.id === item.id);
                return (
                  <g key={item.id} transform={`translate(${item.x} ${item.y})`}>
                    <rect width={item.w} height={item.h} rx={8} fill={item.id === selected ? "#243044" : "#fffcf8"} stroke="#243044" />
                    <text x={12} y={28} fontSize={13} fill={item.id === selected ? "#f4f2ec" : "#1a1c21"}>{def?.title ?? item.id}</text>
                    <text x={12} y={48} fontSize={11} fill={item.id === selected ? "#d5dbe3" : "#5c616b"}>{def?.type}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        <aside className="border-l border-line p-4">
          <h2 className="mb-2 text-sm font-semibold">Inspector</h2>
          {node ? (
            <div className="grid gap-2">
              <FieldLabel>Title</FieldLabel>
              <Input aria-label="Node title" value={node.title} onChange={(event) => apply(updateNode(state, node.id, { title: event.target.value }))} />
              <FieldLabel>Role</FieldLabel>
              <Input aria-label="Assignment role" value={node.role ?? ""} onChange={(event) => apply(updateNode(state, node.id, { role: event.target.value }))} />
              <FieldLabel>Timer delay ms</FieldLabel>
              <Input aria-label="Timer delay" type="number" value={node.delayMs ?? 0} onChange={(event) => apply(updateNode(state, node.id, { delayMs: Number(event.target.value) }))} />
              <FieldLabel>HTTP URL</FieldLabel>
              <Input aria-label="HTTP URL" value={node.url ?? ""} onChange={(event) => apply(updateNode(state, node.id, { url: event.target.value }))} />
              <FieldLabel>Retry limit</FieldLabel>
              <Input aria-label="Retry limit" type="number" value={node.retryLimit ?? 6} onChange={(event) => apply(updateNode(state, node.id, { retryLimit: Number(event.target.value) }))} />
              <FieldLabel>Join</FieldLabel>
              <select aria-label="Join policy" className="h-10 rounded-md border border-line px-2" value={node.join ?? "all"} onChange={(event) => apply(setJoin(state, node.id, event.target.value as "all" | "any" | "n", node.joinCount ?? 1))}>
                <option value="all">ALL</option>
                <option value="any">ANY</option>
                <option value="n">N of M</option>
              </select>
              <FieldLabel>Email template</FieldLabel>
              <Input aria-label="Email template" value={node.emailTemplate ?? ""} onChange={(event) => apply(updateNode(state, node.id, { emailTemplate: event.target.value, service: "email" }))} />
              <FieldLabel>AI instruction</FieldLabel>
              <Input aria-label="AI instruction" value={node.aiInstruction ?? ""} onChange={(event) => apply(updateNode(state, node.id, { aiInstruction: event.target.value, service: "ai" }))} />
              <FieldLabel>ECM profile</FieldLabel>
              <Input aria-label="ECM profile" value={node.ecmProfile ?? ""} onChange={(event) => apply(updateNode(state, node.id, { ecmProfile: event.target.value, service: "ecm" }))} />
              <div className="flex gap-2">
                <Button onClick={() => setEdgeFrom(node.id)}>{edgeFrom === node.id ? "Pick target" : "Connect from here"}</Button>
                <Button onClick={() => { apply(removeNode(state, node.id)); setSelected(null); }}>Delete</Button>
                <Button onClick={() => node && apply(disconnect(state, node.id, state.present.edges.find((edge) => edge.from === node.id)?.to ?? ""))}>Drop edge</Button>
              </div>
            </div>
          ) : <p className="text-sm text-muted">Select a node.</p>}
          <h3 className="mt-4 text-sm font-semibold">Validation</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {issues.length === 0 ? <li className="text-ok">Graph is valid.</li> : issues.map((issue) => <li key={`${issue.code}${issue.nodeId ?? ""}`}>{issue.message}</li>)}
          </ul>
        </aside>
      </div>
    </div>
  );
}
