import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DeveloperPortal } from "@/components/developer/portal";
import { AppHeader } from "@/components/shell";
import { toJsonSchema } from "@/lib/forms/schema-export";
import { useFormStore } from "@/lib/forms/store";

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
            Agent, MCP, and platform routes run in this app. The TypeScript client, the Angular view models, and the meridian-form element call those routes.
          </p>
        </header>
        <label className="grid gap-1 text-sm">Published form
          <select className="h-11 rounded-md border border-line bg-elevated px-3" value={form?.name ?? ""} onChange={(event) => setName(event.target.value)}>
            {published.map((item) => <option key={item.id} value={item.name}>{item.title}</option>)}
          </select>
        </label>
        <DeveloperPortal schema={schema} />
      </main>
    </div>
  );
}
