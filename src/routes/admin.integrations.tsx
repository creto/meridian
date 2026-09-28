import { createFileRoute } from "@tanstack/react-router";
import { AdminScreen } from "@/components/admin/screen";
export const Route = createFileRoute("/admin/integrations")({ component: () => <AdminScreen section="integrations" /> });
