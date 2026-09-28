import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/shell";

export const Route = createFileRoute("/reference")({ component: ReferencePage });

function ReferencePage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-3xl gap-8 px-4 py-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Reference</h1>
          <p className="mt-2 text-sm text-muted">
            Meridian keeps a Form.io-shaped JSON schema, renders it, validates it, and exposes the same object to people and agents. The renderer is original. It does not vendor formio.js. Legacy JavaScript inside imported forms is reported and never executed.
          </p>
        </header>
        <section className="grid gap-2">
          <h2 className="text-xl font-semibold">Safe expressions</h2>
          <p className="text-sm text-muted">Visibility, calculations, and custom checks use this language. There is no eval.</p>
          <pre className="overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{`supplierType == "colombian_company" and country == "CO"
paymentMethod == "transfer"
quantity * unitPrice
SUM(lines, "lineTotal")
empty(taxId)
not hidden`}</pre>
          <p className="text-sm text-muted">Comparisons cover equality and ordering. Logic uses and, or, and not. Text uses contains, startsWith, endsWith, and in. Functions: empty, exists, len, IF, SUM, AVG, MIN, MAX, COUNT, round, abs.</p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-xl font-semibold">What is stored</h2>
          <ul className="grid gap-2 text-sm text-muted">
            <li>Forms, versions, submissions, and workflow history stay in this browser workspace. That is the system of record for the studio.</li>
            <li>The workspace archive stores PDF bytes (name, size, SHA-256, and the file). Download them from a submission after approval.</li>
            <li>S3, MinIO, Azure Blob, GCS, SharePoint, CMIS, and generic REST are protocol clients. Test connection performs the HTTP call. Success is only recorded when the service responds successfully. Secrets stay in the server process vault and are not written into the form or this browser.</li>
            <li>A named provider without a tested connection does not count as stored. The archive step stops and records the error.</li>
          </ul>
        </section>
        <section className="grid gap-2">
          <h2 className="text-xl font-semibold">Imports</h2>
          <p className="text-sm text-muted">CSV and Excel are profiled column by column unless the sheet is a field table with Field and Type columns. JSON can be a sample object, a JSON Schema, or a Form.io component tree. Unsupported Form.io types become text fields with a review note instead of being dropped.</p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-xl font-semibold">Agent contract</h2>
          <pre className="overflow-auto rounded-xl bg-chrome p-4 font-mono text-xs text-chrome-fg">{`GET  /agent/v1/forms/{name}/capabilities
GET  /agent/v1/forms/{name}/input-schema
POST /agent/v1/forms/{name}/validate-object
POST /agent/v1/forms/{name}/submit-object
Header Idempotency-Key`}</pre>
          <p className="text-sm text-muted">The console runs these operations against the workspace. Repeat a key with the same payload and you get the original submission. A different payload returns IDEMPOTENCY_CONFLICT. More than 30 agent submits in a minute returns RATE_LIMITED.</p>
        </section>
      </main>
    </div>
  );
}
