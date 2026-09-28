import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio/studio";

export const Route = createFileRoute("/studio/$formId")({
  component: StudioRoute,
});

function StudioRoute() {
  const { formId } = Route.useParams();
  return <Studio formId={formId} />;
}
