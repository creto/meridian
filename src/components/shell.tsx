import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BookOpen, Bot, Code2, Inbox, Plus, Search, Settings, SquarePen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useFormStore } from "@/lib/forms/store";

const NAV = [
  { to: "/", label: "Forms", icon: SquarePen },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/agent", label: "Agent", icon: Bot },
  { to: "/search", label: "Search", icon: Search },
  { to: "/admin", label: "Admin", icon: Settings },
  { to: "/developer", label: "API", icon: Code2 },
  { to: "/reference", label: "Reference", icon: BookOpen },
] as const;

export function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-chrome text-chrome-fg">
      <div className="grid justify-items-center gap-3">
        <Mark invert />
        <p className="text-sm text-chrome-muted">Meridian</p>
      </div>
    </div>
  );
}

export function Mark({ className, invert = false }: { className?: string; invert?: boolean }) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={28}
      height={28}
      className={cn("size-7 object-contain", invert && "brightness-0 invert", className)}
      aria-hidden="true"
    />
  );
}

export function AppHeader() {
  const openCreate = useFormStore((s) => s.setCreateOpen);
  const inbox = useFormStore((s) => s.submissions.filter((item) => item.status === "in_review").length);
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Mark className="size-6" />
          Meridian
        </Link>
        <nav className="ml-2 flex items-center gap-1 overflow-x-auto" aria-label="Primary">
          {NAV.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm",
                  active ? "bg-paper text-paper-fg" : "text-muted hover:bg-paper",
                )}
              >
                <Icon className="size-4" />
                {item.label}
                {item.to === "/inbox" && inbox > 0 ? (
                  <span className="rounded-sm bg-accent px-1.5 text-xs text-accent-fg tabular-nums">{inbox}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="hidden h-10 items-center gap-2 rounded-md border border-line px-2 text-xs text-muted sm:inline-flex" onClick={() => window.dispatchEvent(new Event("meridian:palette"))}>
            <Search className="size-3.5" />
            Search
            <kbd className="rounded-sm border border-line px-1 font-mono">Ctrl K</kbd>
          </button>
          <Button className="h-10" onClick={() => openCreate(true)}>
            <Plus className="size-4" />
            New
          </Button>
        </div>
      </div>
    </header>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const forms = useFormStore((s) => s.forms);
  const extra = useFormStore((s) => s.palette);
  const setCreateOpen = useFormStore((s) => s.setCreateOpen);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    const onEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("meridian:palette", onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("meridian:palette", onEvent);
    };
  }, []);

  const commands = useMemo(() => {
    const base = [
      { id: "new", label: "Create form", run: () => setCreateOpen(true) },
      { id: "inbox", label: "Open inbox", run: () => void navigate({ to: "/inbox" }) },
      { id: "agent", label: "Open agent console", run: () => void navigate({ to: "/agent" }) },
      { id: "ref", label: "Open reference", run: () => void navigate({ to: "/reference" }) },
      ...forms.map((form) => ({
        id: form.id,
        label: `Edit ${form.title}`,
        run: () => void navigate({ to: "/studio/$formId", params: { formId: form.id } }),
      })),
      ...extra.map((item) => ({ id: item.id, label: item.label, run: item.run })),
    ];
    const q = query.trim().toLowerCase();
    return q ? base.filter((item) => item.label.toLowerCase().includes(q)) : base;
  }, [extra, forms, navigate, query, setCreateOpen]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-chrome/50 px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
      <div className="mx-auto w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface text-paper-fg shadow-lg rise" onMouseDown={(event) => event.stopPropagation()}>
        <label className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search forms and commands"
            className="h-12 w-full bg-transparent text-sm outline-none"
          />
        </label>
        <ul className="max-h-80 overflow-auto p-1">
          {commands.length === 0 ? <li className="px-3 py-6 text-sm text-muted">No matches</li> : null}
          {commands.slice(0, 12).map((command) => (
            <li key={command.id}>
              <button
                type="button"
                className="flex h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-paper"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  command.run();
                }}
              >
                {command.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
