import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/shell";
import { Button, Input } from "@/components/ui/primitives";

interface DocumentMeta {
  documentId: string;
  generatedHash: string;
  status: string;
  createdAt: string;
  createdBy: string;
  sourceHash: string;
}

export const Route = createFileRoute("/pdf/documents")({ component: DocumentsPage });

function DocumentsPage() {
  const [tenantId, setTenantId] = useState("ten_northwind");
  const [submissionId, setSubmissionId] = useState("sub_demo");
  const [note, setNote] = useState("");
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function generate(regenerateId?: string) {
    setError(null);
    const path = regenerateId ? "/api/platform/documents/regenerate" : "/api/platform/documents";
    const sent = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(regenerateId
        ? { tenantId, submissionId, documentId: regenerateId, actor: "preview", text: note || "regenerated" }
        : { tenantId, submissionId, formVersionId: 1, actor: "preview", pageCount: 1, data: { vendor: note || "Northwind" }, placements: [{ id: "vendor", page: 1, x: 0.1, y: 0.12, w: 0.5, h: 0.06, rotation: 0, componentKey: "vendor", pdfFieldType: "text", font: "Helvetica", fontSize: 12, align: "left", format: "", required: true }] }),
    });
    const payload = await sent.json() as { documents?: DocumentMeta[]; document?: DocumentMeta; error?: { message: string } };
    if (!sent.ok) {
      setError(payload.error?.message ?? "Could not store the document");
      return;
    }
    if (payload.documents) setDocs(payload.documents);
    else if (payload.document) setDocs((current) => [...current, payload.document!]);
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Generated documents</h1>
          <p className="mt-2 text-sm text-muted">Each generate stores a new document id, hash, and audit row. Regenerating keeps the previous row. Bytes stay in this server process until a storage connection is tested.</p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Tenant" value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
          <Input aria-label="Submission" value={submissionId} onChange={(event) => setSubmissionId(event.target.value)} />
          <Input aria-label="Note" placeholder="note" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button onClick={() => void generate()}>Generate</Button>
        </div>
        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
        <ul className="grid gap-2">
          {docs.map((doc) => (
            <li key={doc.documentId} className="rounded-md border border-line p-3 text-sm">
              <p className="font-mono text-xs">{doc.documentId}</p>
              <p>{doc.status} · {doc.createdBy} · {doc.createdAt}</p>
              <p className="truncate text-muted">hash {doc.generatedHash}</p>
              <Button className="mt-2" onClick={() => void generate(doc.documentId)}>Regenerate</Button>
            </li>
          ))}
        </ul>
        <Link to="/admin" className="text-sm underline">Back to admin</Link>
      </main>
    </div>
  );
}
