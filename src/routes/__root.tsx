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
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
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
    const send = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const state = useFormStore.getState();
        void fetch("/api/agent/v1/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: Date.now(),
            forms: state.forms,
            submissions: state.submissions,
            idempotency: state.idempotency,
          }),
        });
      }, 400);
    };
    send();
    const unsub = useFormStore.subscribe(send);
    return () => {
      window.clearTimeout(timer);
      unsub();
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
