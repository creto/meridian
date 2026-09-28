import { useMemo, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { ERRORS, GROUPS, LIMITS, OPERATIONS, SDK_NOTES, operationById, substitute, type ApiOperation } from "@/lib/developer/catalog";

export function DeveloperPortal({ schema }: { schema: string }) {
  const [group, setGroup] = useState<ApiOperation["group"]>("overview");
  const [operationId, setOperationId] = useState("platform-connectors");
  const [formName, setFormName] = useState("");
  const [output, setOutput] = useState("Pick an operation and try it. POST tries only the operations marked safe.");
  const [busy, setBusy] = useState(false);
  const operations = useMemo(() => OPERATIONS.filter((item) => item.group === group || group === "overview"), [group]);
  const operation = operationById(operationId) ?? OPERATIONS[0]!;

  async function tryIt() {
    if (!operation.tryable) {
      setOutput("This operation is documented here and is not sent from the browser, because it needs a credential or would write data.");
      return;
    }
    setBusy(true);
    try {
      const path = substitute(operation.path, { name: formName || "example" });
      const response = await fetch(path, {
        method: operation.method,
        headers: operation.method === "GET" ? undefined : { "content-type": "application/json" },
        body: operation.method === "GET" ? undefined : JSON.stringify(operation.body ?? {}),
      });
      const text = await response.text();
      setOutput(`${response.status}\n${text.slice(0, 4000)}`);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <nav className="flex flex-wrap gap-2" aria-label="Developer sections">
        {GROUPS.map((item) => (
          <button key={item} type="button" className={`rounded-md border border-line px-2 py-1 text-sm ${item === group ? "bg-paper" : "text-muted"}`} onClick={() => setGroup(item)}>
            {item}
          </button>
        ))}
      </nav>
      {group === "schemas" ? (
        <pre className="max-h-96 overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{schema || "Publish a form to see its JSON schema."}</pre>
      ) : null}
      {group === "sdks" ? (
        <ul className="grid gap-3">
          {SDK_NOTES.map((sdk) => (
            <li key={sdk.name} className="rounded-md border border-line p-3 text-sm">
              <strong>{sdk.name}</strong>
              <p className="mt-1 text-muted">{sdk.note}</p>
              <p className="mt-1 font-mono text-xs">{sdk.path}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {group === "examples" ? (
        <pre className="overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{`const client = createMeridianClient({ baseUrl, apiKey });
await client.validate(formName, data);
await client.submit(formName, data, { idempotencyKey });`}</pre>
      ) : null}
      {group === "errors" ? (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th>Code</th><th>Status</th><th>Meaning</th></tr></thead>
          <tbody>{ERRORS.map((error) => <tr key={error.code} className="border-t border-line"><td className="font-mono">{error.code}</td><td>{error.status}</td><td>{error.meaning}</td></tr>)}</tbody>
        </table>
      ) : null}
      {group === "limits" ? (
        <ul className="grid gap-2 text-sm">{LIMITS.map((limit) => <li key={limit.name} className="rounded-md border border-line p-3">{limit.name}: {limit.limit} ({limit.window})</li>)}</ul>
      ) : null}
      {group === "clients" ? (
        <p className="text-sm text-muted">API clients are created in Admin, API clients. The secret is shown once and stored as a hash. This page does not display secret hashes.</p>
      ) : null}
      {group === "auth" ? (
        <p className="text-sm text-muted">Local passwords are Argon2id. OIDC builds an authorization URL with PKCE, state, and nonce. The callback checks state and nonce. ID token signatures are not verified until a live JWKS is configured.</p>
      ) : null}
      {group !== "schemas" && group !== "sdks" && group !== "examples" && group !== "errors" && group !== "limits" && group !== "clients" ? (
        <section className="grid gap-3">
          <label className="grid gap-1 text-sm">Operation
            <select className="h-11 rounded-md border border-line bg-elevated px-3" value={operation.id} onChange={(event) => setOperationId(event.target.value)}>
              {operations.map((item) => <option key={item.id} value={item.id}>{item.method} {item.path}</option>)}
            </select>
          </label>
          <p className="text-sm">{operation.summary}</p>
          <p className="text-xs text-muted">Auth: {operation.auth}</p>
          <label className="grid gap-1 text-sm">Form name
            <input className="h-11 rounded-md border border-line bg-elevated px-3" value={formName} onChange={(event) => setFormName(event.target.value)} />
          </label>
          <Button disabled={busy} onClick={() => void tryIt()}>{busy ? "Sending" : operation.tryable ? "Try request" : "Show why this is not tried"}</Button>
          <pre className="max-h-80 overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg" aria-live="polite">{output}</pre>
        </section>
      ) : null}
    </div>
  );
}
