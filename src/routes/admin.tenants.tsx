import { createFileRoute } from "@tanstack/react-router";
import { AdminScreen } from "@/components/admin/screen";
export const Route = createFileRoute("/admin/tenants")({ component: () => <AdminScreen section="tenants" /> });
