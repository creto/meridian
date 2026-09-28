import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui/primitives";
import type { ConsoleSnapshot } from "@/lib/admin/console";

const LINKS = [
  ["tenants", "/admin/tenants"],
  ["users", "/admin/users"],
  ["roles", "/admin/roles"],
  ["workspaces", "/admin/workspaces"],
  ["storage", "/admin/storage"],
  ["ecm", "/admin/ecm"],
  ["integrations", "/admin/integrations"],
  ["ai", "/admin/ai"],
  ["api-clients", "/admin/api-clients"],
  ["webhooks", "/admin/webhooks"],
  ["jobs", "/admin/jobs"],
  ["audit", "/admin/audit"],
  ["feature-flags", "/admin/feature-flags"],
  ["health", "/admin/health"],
  ["settings", "/admin/settings"],
] as const;

async function load(): Promise<ConsoleSnapshot> {
  const response = await fetch("/api/admin/console");
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<ConsoleSnapshot>;
}

async function act(body: Record<string, unknown>): Promise<ConsoleSnapshot> {
  const response = await fetch("/api/admin/console", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { snapshot?: ConsoleSnapshot; error?: { message: string }; inviteToken?: string | null };
  if (!response.ok || !payload.snapshot) throw new Error(payload.error?.message ?? "Command failed");
  if (payload.inviteToken) window.sessionStorage.setItem("meridian.invite", payload.inviteToken);
  return payload.snapshot;
}

export function AdminScreen({ section }: { section: (typeof LINKS)[number][0] }) {
  const [snapshot, setSnapshot] = useState<ConsoleSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    let gone = false;
    load().then((next) => {
      if (!gone) setSnapshot(next);
    }).catch((reason: unknown) => {
      if (!gone) setError(reason instanceof Error ? reason.message : "Directory unavailable");
    });
    return () => {
      gone = true;
    };
  }, []);

  async function run(body: Record<string, unknown>) {
    setError(null);
    try {
      setSnapshot(await act(body));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Command failed");
    }
  }

  const users = (snapshot?.users ?? []).filter((user) => `${user.email} ${user.name}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[220px_1fr]">
      <nav className="border-r border-line bg-surface p-4" aria-label="Admin">
        <Link to="/admin" className="mb-3 block font-semibold">Meridian admin</Link>
        {LINKS.map(([id, href]) => (
          <Link key={id} to={href} className={`block rounded-md px-2 py-1.5 text-sm ${id === section ? "bg-paper" : "text-muted"}`}>{id}</Link>
        ))}
      </nav>
      <main className="p-6">
        <h1 className="mb-4 text-2xl font-semibold capitalize">{section.replace("-", " ")}</h1>
        {error ? <p className="mb-3 text-sm text-danger" role="alert">{error}</p> : null}
        {!snapshot ? <p className="text-sm text-muted">Loading the tenant directory…</p> : null}
        {snapshot && section === "users" ? (
          <div className="grid gap-3">
            <Input aria-label="Search users" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Email" placeholder="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <Input aria-label="Name" placeholder="name" value={name} onChange={(event) => setName(event.target.value)} />
              <Input aria-label="Password" type="password" placeholder="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <Button onClick={() => void run({ action: "create-user", email, name, password })}>Create</Button>
              <Button onClick={() => void run({ action: "invite-user", email, name })}>Invite</Button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted"><th>Name</th><th>Email</th><th>Roles</th><th>Last login</th><th></th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-line">
                    <td>{user.name}{user.disabled ? " (disabled)" : ""}</td>
                    <td>{user.email}</td>
                    <td>{user.roles.join(", ") || user.role || "—"}</td>
                    <td>{user.lastLogin ?? "never"}</td>
                    <td className="flex flex-wrap gap-2 py-1">
                      <Button onClick={() => void run({ action: "disable-user", userId: user.id, disabled: !user.disabled })}>{user.disabled ? "Enable" : "Disable"}</Button>
                      <Button onClick={() => void run({ action: "revoke-sessions", userId: user.id })}>Revoke sessions</Button>
                      <Button onClick={() => void run({ action: "assign-role", userId: user.id, role: "reviewer" })}>Make reviewer</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 ? <p className="text-sm text-muted">No users in this tenant yet.</p> : null}
          </div>
        ) : null}
        {snapshot && section === "roles" ? (
          <ul className="space-y-2 text-sm">
            {snapshot.roles.map((role) => (
              <li key={role.id} className="rounded-md border border-line p-3">
                {role.name} — {role.permissions.join(", ") || "no permissions"}
                <Button className="ml-2" onClick={() => void run({ action: "clone-role", roleId: role.id, name: `${role.name}-copy` })}>Clone</Button>
              </li>
            ))}
            {snapshot.roles.length === 0 ? <li className="text-muted">No roles yet. Assigning a role creates it.</li> : null}
          </ul>
        ) : null}
        {snapshot && (section === "tenants" || section === "workspaces") ? (
          <div className="grid gap-3">
            <ul className="space-y-2">{snapshot.tenants.map((tenant) => <li key={tenant.id} className="rounded-md border border-line p-3">{tenant.name} <span className="text-muted">{tenant.id}</span></li>)}</ul>
            <ul className="space-y-2">{snapshot.workspaces.map((workspace) => <li key={workspace.id} className="rounded-md border border-line p-3">{workspace.name}</li>)}</ul>
            {section === "workspaces" ? <Button onClick={() => void run({ action: "add-workspace", workspaceName: "Operations" })}>Add workspace</Button> : null}
          </div>
        ) : null}
        {snapshot && (section === "storage" || section === "ecm") ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Connection name" placeholder="name" value={name} onChange={(event) => setName(event.target.value)} />
              <Input aria-label="Endpoint" placeholder="https://s3.example.com" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
              <Button onClick={() => void run({ action: "save-connection", kind: section === "storage" ? "storage" : "ecm", name, endpoint, provider: section === "storage" ? "s3" : "rest", secretName: "secret:connection" })}>Save</Button>
            </div>
            <ul className="space-y-2">
              {snapshot.connections.filter((item) => item.kind === (section === "storage" ? "storage" : "ecm")).map((item) => (
                <li key={item.id} className="rounded-md border border-line p-3 text-sm">
                  <strong>{item.name}</strong> {item.provider} · secret {item.secretName ?? "none"} · tested {item.testedAt ?? "never"}
                  <div className="mt-2"><Button onClick={() => void run({ action: "test-connection", roleId: item.id })}>Test shape</Button></div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {snapshot && section === "jobs" ? (
          <ul className="space-y-2 text-sm">
            {snapshot.jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line p-3">
                <span>{job.type}</span><span>{job.status}</span><span className="text-muted">{job.payloadKeys.join(", ") || "no payload keys"}</span>
                <Button onClick={() => void run({ action: "retry-job", jobId: job.id })}>Retry</Button>
                <Button onClick={() => void run({ action: "cancel-job", jobId: job.id })}>Cancel</Button>
              </li>
            ))}
            {snapshot.jobs.length === 0 ? <li className="text-muted">No jobs.</li> : null}
          </ul>
        ) : null}
        {snapshot && section === "audit" ? (
          <div>
            <p className={snapshot.chain.ok ? "text-ok" : "text-danger"}>{snapshot.chain.ok ? `Hash chain verifies (${snapshot.chain.checked} rows).` : "Hash chain does not verify."}</p>
            <Button className="mt-2" onClick={() => void run({ action: "export-audit" })}>Export</Button>
            <ul className="mt-3 space-y-1 text-sm">{snapshot.audit.map((row) => <li key={row.seq}>{row.actor} {row.action} {row.target}</li>)}</ul>
          </div>
        ) : null}
        {snapshot && section === "feature-flags" ? (
          <div className="grid gap-2">
            <Button onClick={() => void run({ action: "set-flag", flag: "pdfEditor", enabled: true })}>Enable pdfEditor</Button>
            <ul>{snapshot.flags.map((flag) => <li key={`${flag.scope}-${flag.name}`}>{flag.name} {flag.scope} {flag.enabled ? "on" : "off"} {flag.rollout ?? "—"}%</li>)}</ul>
          </div>
        ) : null}
        {snapshot && section === "api-clients" ? <ul>{snapshot.apiClients.map((client) => <li key={client.id}>{client.name} role {client.role} public {client.publicId} {client.revoked ? "revoked" : "active"}</li>)}{snapshot.apiClients.length === 0 ? <li className="text-muted">No API clients.</li> : null}</ul> : null}
        {snapshot && section === "webhooks" ? <ul>{snapshot.webhooks.map((hook) => <li key={hook.id}>{hook.url} {hook.enabled ? "enabled" : "disabled"} · {hook.secretName}</li>)}{snapshot.webhooks.length === 0 ? <li className="text-muted">No webhooks.</li> : null}</ul> : null}
        {snapshot && (section === "integrations" || section === "ai") ? <ul>{snapshot.integrations.map((item) => <li key={item.id}>{item.name} ({item.kind})</li>)}{snapshot.integrations.length === 0 ? <li className="text-muted">No recorded AI calls.</li> : null}</ul> : null}
        {snapshot && section === "health" ? <p>Users {snapshot.health.users}. Forms {snapshot.health.forms}. Submissions {snapshot.health.submissions}. Jobs {snapshot.health.jobs}. Open tasks {snapshot.health.openTasks}. Chain {snapshot.chain.ok ? "ok" : "broken"}.</p> : null}
        {snapshot && section === "settings" ? <p className="text-sm text-muted">Locale and retention stay on tenant_settings. This page does not edit secrets.</p> : null}
      </main>
    </div>
  );
}
