import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/shell";
import { useFormStore } from "@/lib/forms/store";
import { toJsonSchema } from "@/lib/forms/schema-export";

export const Route = createFileRoute("/developer")({ component: DeveloperPage });

function DeveloperPage() {
  const forms = useFormStore((s) => s.forms);
  const published = useMemo(() => forms.filter((form) => form.status === "published"), [forms]);
  const [name, setName] = useState(published[0]?.name ?? "");
  const form = published.find((item) => item.name === name) ?? published[0];
  const schema = form ? JSON.stringify(toJsonSchema(form), null, 2) : "";

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Developer</h1>
          <p className="mt-2 text-sm text-muted">
            The agent API reads the workspace snapshot synced from this browser. Generate on that API uses the on-device designer. There is no Angular SDK and no separate MCP process — tool JSON is served from the same API.
          </p>
        </header>
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Routes</h2>
          <pre className="overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{`GET  /api/agent/v1/forms
GET  /api/agent/v1/forms/{name}
GET  /api/agent/v1/forms/{name}/capabilities
GET  /api/agent/v1/forms/{name}/input-schema
GET  /api/agent/v1/forms/{name}/tool-definition
GET  /api/agent/v1/forms/{name}/openapi
GET  /api/agent/v1/mcp/tools
POST /api/agent/v1/forms/generate
POST /api/agent/v1/forms/{name}/validate-object
POST /api/agent/v1/forms/{name}/submit-object
GET  /api/agent/v1/submissions/{id}
PATCH /api/agent/v1/submissions/{id}`}</pre>
        </section>
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Published schema</h2>
          <label className="grid gap-1 text-sm">Form
            <select className="h-11 rounded-md border border-line bg-elevated px-3" value={form?.name ?? ""} onChange={(e) => setName(e.target.value)}>
              {published.map((item) => <option key={item.id} value={item.name}>{item.title}</option>)}
            </select>
          </label>
          <pre className="max-h-80 overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{schema || "Publish a form to see its schema."}</pre>
        </section>
        <section className="grid gap-2 text-sm text-muted">
          <h2 className="text-lg font-semibold text-paper-fg">Client</h2>
          <p>The TypeScript client is <span className="font-mono">createMeridianClient</span> in the SDK module. It calls the routes above. Idempotency is the <span className="font-mono">Idempotency-Key</span> header.</p>
          <p>Webhooks are signed <span className="font-mono">sha256=</span> over timestamp and body when a secret was stored in the server vault. A restart clears that vault.</p>
        </section>
      </main>
    </div>
  );
}
