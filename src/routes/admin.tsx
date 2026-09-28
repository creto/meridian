import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/shell";
import { Button, Input } from "@/components/ui/primitives";
import { ROLES, grantsFor, type WorkspaceRole } from "@/lib/platform/rbac";
import { LOCAL_CONNECTION, useFormStore } from "@/lib/forms/store";
import { uid } from "@/lib/forms/ids";
import { createLocalProvider } from "@/lib/storage/local";
import type { StorageKind } from "@/lib/storage/types";

export const Route = createFileRoute("/admin")({ component: AdminPage });

const KINDS: StorageKind[] = ["local", "s3", "minio", "azure-blob", "gcs", "sharepoint", "cmis", "rest"];

const FIELDS: Record<StorageKind, string[]> = {
  local: [],
  s3: ["endpoint", "region", "bucket", "accessKeyId", "prefix"],
  minio: ["endpoint", "region", "bucket", "accessKeyId", "prefix"],
  "azure-blob": ["account", "container", "prefix"],
  gcs: ["bucket", "prefix"],
  sharepoint: ["tenant", "clientId", "site", "drive", "folder"],
  cmis: ["browserUrl", "repositoryId", "username", "folder"],
  rest: ["endpoint", "prefix"],
};

function AdminPage() {
  const role = useFormStore((s) => s.role);
  const setRole = useFormStore((s) => s.setRole);
  const connections = useFormStore((s) => s.connections);
  const upsert = useFormStore((s) => s.upsertConnection);
  const remove = useFormStore((s) => s.removeConnection);
  const audit = useFormStore((s) => s.audit);
  const [kind, setKind] = useState<StorageKind>("s3");
  const [name, setName] = useState("Production bucket");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState("");
  const [objects, setObjects] = useState("");
  const webhooks = useFormStore((s) => s.webhooks);
  const upsertWebhook = useFormStore((s) => s.upsertWebhook);
  const [hookUrl, setHookUrl] = useState("");
  const [hookSecret, setHookSecret] = useState("");

  const test = async (connectionId: string, testKind: StorageKind, testConfig: Record<string, string>, testSecret: string) => {
    if (testKind === "local") {
      const provider = createLocalProvider();
      const put = await provider.put({ key: "meridian-healthcheck.txt", body: new TextEncoder().encode("meridian"), contentType: "text/plain" });
      if (!put.ok) return { ok: false, message: put.message };
      await provider.delete(put.key);
      return { ok: true, message: put.ok ? `Wrote ${put.bytes} bytes to the workspace archive` : "Failed", secretSet: false };
    }
    const response = await fetch("/api/storage/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId, kind: testKind, config: testConfig, secret: testSecret || undefined }),
    });
    return (await response.json()) as { ok: boolean; message: string; status?: number; secretSet?: boolean; code?: string };
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Administration</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Connections run real requests. A secret is sent once to the server vault and is not shown again. The vault lives in this server process — it is not a KMS, and a restart clears it. Nothing is marked connected until the request succeeds.
          </p>
        </header>
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Admin sections">
          <Link className="rounded-md border border-line px-2 py-1" to="/admin/users">Users</Link>
          <Link className="rounded-md border border-line px-2 py-1" to="/admin/roles">Roles</Link>
          <Link className="rounded-md border border-line px-2 py-1" to="/admin/jobs">Jobs</Link>
          <Link className="rounded-md border border-line px-2 py-1" to="/admin/audit">Audit</Link>
          <Link className="rounded-md border border-line px-2 py-1" to="/admin/storage">Storage</Link>
          <Link className="rounded-md border border-line px-2 py-1" to="/admin/health">Health</Link>
          <Link className="rounded-md border border-line px-2 py-1" to="/pdf/templates/$templateId/editor" params={{ templateId: "northwind" }}>PDF editor</Link>
          <Link className="rounded-md border border-line px-2 py-1" to="/workflows/$workflowId/editor" params={{ workflowId: "northwind" }}>Workflow editor</Link>
        </nav>
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-semibold">Role</h2>
          <p className="mt-1 text-sm text-muted">Enforced on save, publish, submit, and approval. Hiding a button is not the check.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ROLES.map((item) => (
              <Button key={item} variant={role === item ? "primary" : "secondary"} className="h-10 capitalize" onClick={() => setRole(item as WorkspaceRole)}>{item}</Button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{grantsFor(role).join(" · ")}</p>
        </section>
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-semibold">Storage and ECM</h2>
          <ul className="mt-3 grid gap-2">
            {(connections ?? [LOCAL_CONNECTION]).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="font-mono text-xs text-muted">{item.kind}</span>
                <span className="text-xs text-muted">{item.enabled ? "enabled" : "disabled"}</span>
                <span className="text-xs text-muted">{item.secretSet ? "secret loaded" : "no secret"}</span>
                {item.lastTest ? <span className="text-xs">{item.lastTest.ok ? "last test ok" : "last test failed"}</span> : null}
                {item.id !== "conn_local" ? (
                  <Button variant="ghost" className="ml-auto h-9" onClick={() => remove(item.id)}>Delete</Button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Name
              <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Connection name" />
            </label>
            <label className="grid gap-1 text-sm">Type
              <select className="h-11 rounded-md border border-line bg-elevated px-3" value={kind} onChange={(e) => setKind(e.target.value as StorageKind)}>
                {KINDS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            {FIELDS[kind].map((field) => (
              <label key={field} className="grid gap-1 text-sm">{field}
                <Input value={config[field] ?? ""} onChange={(e) => setConfig({ ...config, [field]: e.target.value })} aria-label={field} />
              </label>
            ))}
            {kind !== "local" ? (
              <label className="grid gap-1 text-sm sm:col-span-2">Secret
                <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Sent once. Not stored in the form." aria-label="Secret" />
              </label>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => {
              const id = uid("conn");
              void test(id, kind, config, secret).then((tested) => {
                upsert({
                  id,
                  name: name || kind,
                  kind,
                  enabled: true,
                  config,
                  secretSet: Boolean(tested.secretSet || secret),
                  lastTest: { ok: tested.ok, at: new Date().toISOString(), message: tested.message },
                });
                setSecret("");
                setResult(tested.ok ? tested.message : `${tested.message}`);
                toast[tested.ok ? "success" : "error"](tested.ok ? "Connection succeeded" : "Connection failed");
              });
            }}>Test and save</Button>
            <Button variant="secondary" onClick={() => {
              void createLocalProvider().list("").then((listed) => {
                setObjects(listed.ok ? listed.keys.map((item) => `${item.key}  ${item.bytes}  ${item.sha256.slice(0, 12)}`).join("\n") || "Archive is empty." : listed.message);
              });
            }}>List archive</Button>
          </div>
          {result ? <p className="mt-3 text-sm">{result}</p> : null}
          {objects ? <pre className="mt-3 overflow-auto rounded-lg bg-chrome p-3 font-mono text-xs text-chrome-fg">{objects}</pre> : null}
        </section>
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-semibold">Webhooks</h2>
          <p className="mt-1 text-sm text-muted">Delivery is a signed POST with up to three attempts. A 4xx response is not retried. The signing secret is sent once to the server vault and is not stored in this browser.</p>
          <ul className="mt-3 grid gap-1 text-sm">
            {(webhooks ?? []).map((hook) => <li key={hook.id}>{hook.url}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input className="max-w-md" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://example.com/hooks/meridian" aria-label="Webhook URL" />
            <Input className="max-w-xs" type="password" value={hookSecret} onChange={(e) => setHookSecret(e.target.value)} placeholder="Signing secret" aria-label="Webhook secret" />
            <Button variant="secondary" onClick={() => {
              if (!hookUrl.trim()) return;
              const id = uid("hook");
              if (hookSecret) {
                void fetch("/api/hooks/deliver", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ webhookId: id, url: hookUrl.trim(), event: "webhook.secret", payload: {}, secret: hookSecret }),
                });
              }
              upsertWebhook({ id, url: hookUrl.trim(), events: ["submission.created", "submission.updated"], enabled: true, secretSet: Boolean(hookSecret) });
              setHookUrl("");
              setHookSecret("");
              toast.success(hookSecret ? "Webhook saved. The signing secret was sent to the server vault." : "Webhook saved without a signing secret");
            }}>Save webhook</Button>
          </div>
        </section>
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-semibold">Audit</h2>
          <ul className="mt-3 grid gap-1 text-sm text-muted">
            {audit.length === 0 ? <li>No events yet.</li> : null}
            {audit.slice(0, 30).map((event) => (
              <li key={event.id}>{new Date(event.at).toLocaleString()} — {event.actor} {event.action} {event.detail ? `· ${event.detail}` : ""}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
