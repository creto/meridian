import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/shell";
import { Button, Input } from "@/components/ui/primitives";
import { useFormStore } from "@/lib/forms/store";

export const Route = createFileRoute("/search")({ component: SearchPage });

function SearchPage() {
  const submissions = useFormStore((s) => s.submissions);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState(0);
  const [job, setJob] = useState<string>("");
  const pageSize = 20;
  const filtered = useMemo(() => {
    return submissions.filter((item) => {
      if (status && item.status !== status) return false;
      if (text && !JSON.stringify(item.data).toLowerCase().includes(text.toLowerCase())) return false;
      return true;
    });
  }, [submissions, status, text]);
  const page = filtered.slice(cursor, cursor + pageSize);

  async function exportPage() {
    const queued = await fetch("/api/platform/jobs/enqueue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "ten_northwind",
        type: "export",
        payload: { filter: { tenantId: "ten_northwind", text, status: status || undefined } },
      }),
    });
    const created = await queued.json() as { id?: string };
    const pumped = await fetch("/api/platform/jobs/pump", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const result = await pumped.json() as { ran?: number };
    setJob(`${created.id ?? "job"} ran ${result.ran ?? 0}`);
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Submissions</h1>
        <p className="text-sm text-muted">This list is the workspace in this browser. Export queues a workbook job in the server process. Cascading lists are on <Link to="/datasources" className="underline">data sources</Link>.</p>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Search text" placeholder="Search answers" value={text} onChange={(event) => { setText(event.target.value); setCursor(0); }} />
          <Input aria-label="Status" placeholder="status" value={status} onChange={(event) => { setStatus(event.target.value); setCursor(0); }} />
          <Button onClick={() => void exportPage()}>Export job</Button>
        </div>
        {job ? <p className="text-sm">{job}</p> : null}
        <p className="text-sm text-muted">{filtered.length} matches</p>
        <ul className="grid gap-2">
          {page.map((item) => (
            <li key={item.id} className="rounded-md border border-line p-3 text-sm">
              <span className="font-medium">{item.formName}</span> · {item.status} · {item.createdAt}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button disabled={cursor === 0} onClick={() => setCursor((current) => Math.max(0, current - pageSize))}>Previous</Button>
          <Button disabled={cursor + pageSize >= filtered.length} onClick={() => setCursor((current) => current + pageSize)}>Next</Button>
        </div>
      </main>
    </div>
  );
}
