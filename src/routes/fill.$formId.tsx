import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FormRuntime } from "@/components/forms/runtime";
import { Mark } from "@/components/shell";
import { downloadBytes, submissionPdf } from "@/lib/forms/pdf";
import { inputLabels } from "@/lib/forms/schema-export";
import { useFormStore } from "@/lib/forms/store";

export const Route = createFileRoute("/fill/$formId")({
  component: FillRoute,
});

function FillRoute() {
  const { formId } = Route.useParams();
  const form = useFormStore((s) => s.forms.find((item) => item.id === formId));
  const submit = useFormStore((s) => s.submit);
  const actor = useFormStore((s) => s.actorName);
  const [lastId, setLastId] = useState<string | null>(null);
  const [lastData, setLastData] = useState<Record<string, unknown> | null>(null);

  if (!form) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <p>This form is not available.</p>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-paper">
      <header className="mx-auto flex h-14 w-full max-w-3xl shrink-0 items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 text-sm font-medium"><Mark className="size-6" /> Meridian</Link>
        {form.status !== "published" ? <span className="text-xs text-warn">Draft — responses still save in this workspace</span> : null}
        {lastId && lastData ? (
          <button
            type="button"
            className="ml-auto text-sm underline"
            onClick={() => {
              void submissionPdf({
                title: form.title,
                name: form.name,
                version: form.version,
                submissionId: lastId,
                data: lastData,
                labels: inputLabels(form),
              }).then(({ bytes }) => downloadBytes(bytes, `${form.name}-${lastId}.pdf`));
            }}
          >
            Download filled PDF
          </button>
        ) : null}
      </header>
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 px-4">
        <FormRuntime
          form={form}
          onDraft={(data) => {
            void submit({ formId: form.id, data, actor, draft: true, source: "human" });
            toast.success("Draft saved");
          }}
          onSubmit={async (data) => {
            const result = await submit({ formId: form.id, data, actor, source: "human" });
            if (!result.ok) return { errors: result.errors, message: result.message };
            setLastId(result.submission?.id ?? null);
            setLastData(data);
            return { message: form.settings.successMessage };
          }}
        />
      </div>
    </main>
  );
}
