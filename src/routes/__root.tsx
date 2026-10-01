import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { CommandPalette } from "@/components/shell";
import { CreateHost } from "@/components/create-host";
import { useFormStore } from "@/lib/forms/store";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Meridian" },
      { name: "description", content: "Design forms for people, systems, and agents." },
      { name: "theme-color", content: "#121316" },
      { property: "og:title", content: "Meridian" },
      { property: "og:description", content: "Dynamic forms for people and agents." },
      { property: "og:image", content: "/og.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    try {
      void Promise.resolve(useFormStore.persist.rehydrate());
    } catch {
      /* keep the in-memory workspace */
    }
  }, []);
  useEffect(() => {
    let timer = 0;
    let stop = false;
    const send = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const state = useFormStore.getState();
        void fetch("/api/agent/v1/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: state.serverRevision ?? 0,
            forms: state.forms,
            submissions: state.submissions,
            idempotency: state.idempotency,
          }),
        }).then(async (response) => {
          if (!response.ok) return;
          const saved = await response.json() as { revision?: number; forms?: typeof state.forms; submissions?: typeof state.submissions; idempotency?: typeof state.idempotency };
          if (saved.revision != null && saved.revision !== useFormStore.getState().serverRevision) {
            const behind = (useFormStore.getState().serverRevision ?? 0) < saved.revision && saved.forms && saved.forms !== useFormStore.getState().forms;
            useFormStore.setState(behind && saved.submissions
              ? { serverRevision: saved.revision, forms: saved.forms, submissions: saved.submissions, idempotency: saved.idempotency ?? [] }
              : { serverRevision: saved.revision });
          }
        }).catch(() => undefined);
      }, 400);
    };
    void fetch("/api/agent/v1/sync")
      .then(async (response) => {
        if (!response.ok) return;
        const server = await response.json() as { revision?: number; forms?: unknown[]; submissions?: unknown[]; idempotency?: unknown[] };
        const local = useFormStore.getState();
        if ((server.revision ?? 0) > (local.serverRevision ?? 0) && Array.isArray(server.forms) && server.forms.length > 0) {
          useFormStore.setState({
            serverRevision: server.revision,
            forms: server.forms as typeof local.forms,
            submissions: (server.submissions ?? []) as typeof local.submissions,
            idempotency: (server.idempotency ?? []) as typeof local.idempotency,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (stop) return;
        send();
        const unsub = useFormStore.subscribe(send);
        stop = true;
        (window as unknown as { __meridianUnsub?: () => void }).__meridianUnsub = unsub;
      });
    return () => {
      window.clearTimeout(timer);
      (window as unknown as { __meridianUnsub?: () => void }).__meridianUnsub?.();
    };
  }, []);
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <CreateHost />
          <CommandPalette />
          <Toaster position="bottom-right" />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
