import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/home/dashboard";

export const Route = createFileRoute("/")({ component: Dashboard });
