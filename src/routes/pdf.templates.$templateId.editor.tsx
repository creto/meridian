import { createFileRoute } from "@tanstack/react-router";
import { TemplateEditor } from "@/components/pdf/template-editor";

export const Route = createFileRoute("/pdf/templates/$templateId/editor")({
  component: PdfTemplateEditorRoute,
});

function PdfTemplateEditorRoute() {
  const { templateId } = Route.useParams();
  return <TemplateEditor templateId={templateId} />;
}
