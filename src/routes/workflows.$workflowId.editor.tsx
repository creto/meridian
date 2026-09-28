import { createFileRoute } from "@tanstack/react-router";
import { WorkflowCanvas } from "@/components/workflow/canvas-editor";

export const Route = createFileRoute("/workflows/$workflowId/editor")({
  component: WorkflowEditorRoute,
});

function WorkflowEditorRoute() {
  const { workflowId } = Route.useParams();
  return <WorkflowCanvas workflowId={workflowId} />;
}
