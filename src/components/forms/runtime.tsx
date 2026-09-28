import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Textarea } from "@/components/ui/primitives";
import { applyCalculations, applyClearOnHide, initialData, isVisible, pageComponents, validateForm, validatePage } from "@/lib/forms/engine";
import { issueCaptcha, readCaptcha, type CaptchaChallenge } from "@/lib/forms/captcha";
import { publicSubmission, readPath, readSetting } from "@/lib/forms/formio/document";
import { upstreamType } from "@/lib/forms/formio/adapter";
import { applyCase, applyInputMask, collapseSpaces, sanitizeHtml, wordCount } from "@/lib/forms/formio/coerce";
import { formatValue } from "@/lib/forms/pdf";
import type { FormComponent, FormDefinition } from "@/lib/forms/types";
import { cn } from "@/lib/cn";

export interface RuntimeResult {
  errors?: Record<string, string>;
  message?: string;
}

interface Props {
  form: FormDefinition;
  frame?: "full" | "tablet" | "phone";
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<RuntimeResult>;
  onDraft?: (data: Record<string, unknown>) => void;
}

function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return crypto.subtle.digest("SHA-256", copy.buffer).then((digest) =>
    [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""),
  );
}

function reviewRows(components: FormComponent[], data: Record<string, unknown>, root: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const walk = (list: FormComponent[]) => {
    for (const component of list) {
      if (!isVisible(component, root)) continue;
      if (component.type === "review" || component.type === "content" || component.type === "button") continue;
      if (component.type === "captcha") {
        rows.push({ label: component.label || "Captcha", value: "Checked when you submit" });
        continue;
      }
      if (component.type === "panel" || component.type === "fieldset" || component.type === "tabs") {
        walk(component.components ?? []);
        continue;
      }
      if (component.type === "columns") {
        component.columns?.forEach((col) => walk(col.components));
        continue;
      }
      if (!component.key) continue;
      rows.push({ label: component.label || component.key, value: formatValue(data[component.key]) });
    }
  };
  walk(components);
  return rows;
}

function FieldShell({ component, value, error, children }: { component: FormComponent; value?: unknown; error?: string; children: React.ReactNode }) {
  const hideLabel = readSetting(component, "hideLabel") === true;
  const position = String(readSetting(component, "labelPosition") ?? "top");
  const tooltip = typeof readSetting(component, "tooltip") === "string" ? String(readSetting(component, "tooltip")) : "";
  const customClass = typeof readSetting(component, "customClass") === "string" ? String(readSetting(component, "customClass")) : "";
  const prefix = typeof readSetting(component, "prefix") === "string" ? String(readSetting(component, "prefix")) : "";
  const suffix = typeof readSetting(component, "suffix") === "string" ? String(readSetting(component, "suffix")) : "";
  const showChars = readSetting(component, "showCharCount") === true;
  const showWords = readSetting(component, "showWordCount") === true;
  const text = value == null ? "" : String(value);
  const horizontal = position === "left" || position === "right";
  return (
    <div className={cn("grid gap-1 text-sm", horizontal && "sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start", customClass)}>
      {hideLabel ? null : (
        <span className={cn("font-medium", position === "bottom" && "order-2")} title={tooltip || undefined}>
          {component.label}{component.required ? <span className="text-danger"> *</span> : null}
        </span>
      )}
      <div className="flex min-w-0 items-center gap-2">
        {prefix ? <span className="text-xs text-muted">{prefix}</span> : null}
        <div className="min-w-0 flex-1">{children}</div>
        {suffix ? <span className="text-xs text-muted">{suffix}</span> : null}
      </div>
      {component.description ? <span className="text-xs text-muted">{component.description}</span> : null}
      {showChars || showWords ? <span className="text-xs text-muted">{showWords ? `${wordCount(text)} words` : ""}{showWords && showChars ? " · " : ""}{showChars ? `${text.length} characters` : ""}</span> : null}
      {error ? <span className="text-xs text-danger" role="alert">{error}</span> : null}
    </div>
  );
}

function normalizeText(component: FormComponent, value: string): string {
  let next = value;
  const mask = readSetting(component, "inputMask");
  if (typeof mask === "string" && mask) next = applyInputMask(mask, next);
  next = collapseSpaces(readSetting(component, "truncateMultipleSpaces"), next);
  return applyCase(readSetting(component, "case"), next);
}

function optionList(body: unknown, selectValues: string): { label: string; value: string }[] {
  const located = selectValues ? readPath(body, selectValues) : body;
  const list = Array.isArray(located) ? located : [];
  return list.slice(0, 200).map((item) => {
    if (item == null || typeof item !== "object") return { label: String(item), value: String(item) };
    const record = item as { label?: unknown; value?: unknown };
    const value = record.value == null ? String(record.label ?? "") : String(record.value);
    return { label: String(record.label ?? value), value };
  }).filter((item) => item.value);
}

function ChoiceSelect({
  component,
  value,
  disabled,
  error,
  onChange,
}: {
  component: FormComponent;
  value: unknown;
  disabled?: boolean;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const src = String(readSetting(component, "dataSrc") ?? "values");
  const url = typeof readSetting(component, "data.url") === "string" ? String(readSetting(component, "data.url")) : "";
  const jsonText = typeof readSetting(component, "data.json") === "string" ? String(readSetting(component, "data.json")) : "";
  const selectValues = typeof readSetting(component, "selectValues") === "string" ? String(readSetting(component, "selectValues")) : "";
  const [remote, setRemote] = useState<{ label: string; value: string }[] | null>(null);
  useEffect(() => {
    if (src === "json" && jsonText.trim()) {
      try {
        setRemote(optionList(JSON.parse(jsonText), selectValues));
      } catch {
        setRemote([]);
      }
      return;
    }
    if (src !== "url" || !/^https?:\/\//i.test(url)) {
      setRemote(null);
      return;
    }
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => setRemote(optionList(body, selectValues)))
      .catch(() => setRemote(null));
    return () => controller.abort();
  }, [src, url, jsonText, selectValues]);
  const options = remote ?? component.values ?? [];
  const multiple = readSetting(component, "multiple") === true;
  if (multiple) {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <select multiple className={cn("min-h-28 w-full rounded-md border bg-elevated px-3 py-2 text-sm", error ? "border-danger" : "border-line")} value={selected} disabled={disabled} aria-label={component.label} onChange={(event) => onChange([...event.target.selectedOptions].map((option) => option.value))}>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    );
  }
  return (
    <select className={cn("h-11 w-full rounded-md border bg-elevated px-3 text-sm", error ? "border-danger" : "border-line")} value={String(value ?? "")} disabled={disabled} aria-label={component.label} aria-invalid={error ? true : undefined} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select</option>
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  );
}

function CaptchaControl({
  value,
  disabled,
  onChange,
}: {
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}) {
  const parsed = readCaptcha(value);
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const refresh = () => {
    const next = issueCaptcha();
    setChallenge(next);
    onChange({ id: next.id, answer: "" });
  };
  useEffect(() => {
    if (challenge) return;
    const next = issueCaptcha();
    setChallenge(next);
    onChange({ id: next.id, answer: "" });
  }, [challenge, onChange]);
  const shown = challenge;
  return (
    <div className="grid gap-2">
      {shown ? (
        <svg viewBox={`0 0 ${shown.width} ${shown.height}`} className="h-16 w-full max-w-xs rounded-md border border-line bg-paper text-paper-fg" role="img" aria-label="Captcha characters">
          {shown.lines.map((line, index) => (
            <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="currentColor" strokeOpacity="0.35" />
          ))}
          {shown.glyphs.map((glyph, index) => (
            <text key={index} x={glyph.x} y={glyph.y} fontSize="28" fontFamily="ui-monospace, monospace" transform={`rotate(${glyph.rotate} ${glyph.x} ${glyph.y})`}>
              {glyph.text}
            </text>
          ))}
        </svg>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={parsed?.answer ?? ""}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          aria-label="Captcha characters"
          placeholder="Characters"
          onChange={(event) => onChange({ id: shown?.id ?? parsed?.id ?? "", answer: event.target.value })}
        />
        <button type="button" className="h-10 shrink-0 rounded-md border border-line px-3 text-sm" disabled={disabled} onClick={refresh}>
          New code
        </button>
      </div>
    </div>
  );
}

function FieldInput({
  component,
  value,
  disabled,
  error,
  onChange,
}: {
  component: FormComponent;
  value: unknown;
  disabled?: boolean;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const common = { disabled, "aria-invalid": error ? true : undefined, "aria-label": component.label };
  const kind = upstreamType(component);
  if (component.type === "captcha" || kind === "recaptcha") {
    return <CaptchaControl value={value} disabled={disabled} onChange={onChange} />;
  }
  if (kind === "survey") {
    const questions = Array.isArray(readSetting(component, "questions")) ? readSetting(component, "questions") as { label?: string; value?: string }[] : [];
    const answers = value && typeof value === "object" ? value as Record<string, string> : {};
    return (
      <div className="grid gap-2">
        {questions.map((question) => {
          const key = String(question.value ?? question.label ?? "");
          return (
            <div key={key} className="grid gap-1">
              <span className="text-sm">{question.label}</span>
              <div className="flex flex-wrap gap-3">
                {(component.values ?? []).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={`${component.id}-${key}`} checked={answers[key] === opt.value} disabled={disabled} onChange={() => onChange({ ...answers, [key]: opt.value })} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (kind === "day") {
    const day = value && typeof value === "object" ? value as Record<string, string> : {};
    const set = (key: string, next: string) => onChange({ ...day, [key]: next });
    return (
      <div className="grid grid-cols-3 gap-2">
        <Input value={day.month ?? ""} placeholder="MM" aria-label="Month" disabled={disabled} onChange={(event) => set("month", event.target.value)} />
        <Input value={day.day ?? ""} placeholder="DD" aria-label="Day" disabled={disabled} onChange={(event) => set("day", event.target.value)} />
        <Input value={day.year ?? ""} placeholder="YYYY" aria-label="Year" disabled={disabled} onChange={(event) => set("year", event.target.value)} />
      </div>
    );
  }
  if (kind === "tags") {
    const tags = Array.isArray(value) ? value.map(String) : typeof value === "string" && value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
    return (
      <Input
        value={tags.join(", ")}
        disabled={disabled}
        placeholder={component.placeholder || "tag, tag"}
        aria-label={component.label}
        onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
      />
    );
  }
  if (component.type === "textarea") {
    const rows = Number(readSetting(component, "rows") ?? 3);
    return <Textarea {...common} rows={Number.isFinite(rows) ? rows : 3} value={String(value ?? "")} placeholder={component.placeholder} spellCheck={readSetting(component, "spellcheck") !== false} onChange={(e) => onChange(normalizeText(component, e.target.value))} />;
  }
  if (component.type === "select") {
    return <ChoiceSelect component={component} value={value} disabled={disabled} error={error} onChange={onChange} />;
  }
  if (component.type === "radio") {
    return (
      <div className="grid gap-2" role="radiogroup" aria-label={component.label} aria-invalid={error ? true : undefined}>
        {(component.values ?? []).map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <input type="radio" name={component.id} checked={value === opt.value} disabled={disabled} onChange={() => onChange(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>
    );
  }
  if (component.type === "checkbox" || component.type === "toggle") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {component.type === "toggle" ? "On" : "Yes"}
      </label>
    );
  }
  if (component.type === "selectboxes") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <div className="grid gap-2">
        {(component.values ?? []).map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={on} disabled={disabled} onChange={() => onChange(on ? selected.filter((item) => item !== opt.value) : [...selected, opt.value])} />
              {opt.label}
            </label>
          );
        })}
      </div>
    );
  }
  if (component.type === "rating") {
    const current = Number(value) || 0;
    return (
      <div className="flex gap-1" role="radiogroup" aria-label={component.label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" disabled={disabled} className={cn("h-10 w-10 rounded-md border border-line", current >= n && "bg-accent text-accent-fg")} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
    );
  }
  if (component.type === "slider") {
    const min = component.min ?? component.validate?.min ?? 0;
    const max = component.max ?? component.validate?.max ?? 100;
    return <input type="range" className="w-full" min={min} max={max} step={component.step ?? 1} value={Number(value) || min} disabled={disabled} aria-label={component.label} onChange={(e) => onChange(Number(e.target.value))} />;
  }
  if (component.type === "file") {
    const meta = value && typeof value === "object" ? value as { name?: string; sha256?: string; size?: number } : null;
    return (
      <div className="grid gap-1">
        <input
          type="file"
          disabled={disabled}
          aria-label={component.label}
          accept={typeof readSetting(component, "filePattern") === "string" ? String(readSetting(component, "filePattern")) : undefined}
          multiple={readSetting(component, "multiple") === true}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              onChange(null);
              return;
            }
            void file.arrayBuffer().then(async (buffer) => {
              const bytes = new Uint8Array(buffer);
              const sha256 = await sha256Hex(bytes);
              onChange({ name: file.name, size: file.size, type: file.type, sha256 });
            });
          }}
        />
        {meta?.name ? <span className="text-xs text-muted">{meta.name} · {meta.sha256?.slice(0, 12)}</span> : null}
      </div>
    );
  }
  if (component.type === "signature") {
    return (
      <Input
        value={String(value ?? "")}
        disabled={disabled}
        placeholder="Type your name"
        aria-label={component.label}
        className="font-serif italic"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (component.type === "address") {
    const addr = (value && typeof value === "object" ? value : { line1: "", city: "", region: "", postalCode: "", country: "" }) as Record<string, string>;
    const set = (key: string, next: string) => onChange({ ...addr, [key]: next });
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Input className="sm:col-span-2" value={addr.line1 ?? ""} placeholder="Street" aria-label="Street" disabled={disabled} onChange={(e) => set("line1", e.target.value)} />
        <Input value={addr.city ?? ""} placeholder="City" aria-label="City" disabled={disabled} onChange={(e) => set("city", e.target.value)} />
        <Input value={addr.region ?? ""} placeholder="Region" aria-label="Region" disabled={disabled} onChange={(e) => set("region", e.target.value)} />
        <Input value={addr.postalCode ?? ""} placeholder="Postal code" aria-label="Postal code" disabled={disabled} onChange={(e) => set("postalCode", e.target.value)} />
        <Input value={addr.country ?? ""} placeholder="Country" aria-label="Country" disabled={disabled} onChange={(e) => set("country", e.target.value)} />
      </div>
    );
  }
  const type = component.type === "email" ? "email"
    : component.type === "phone" ? "tel"
      : component.type === "url" ? "url"
        : component.type === "password" ? "password"
          : component.type === "number" || component.type === "currency" ? "number"
            : component.type === "date" ? "date"
              : component.type === "datetime" ? "datetime-local"
                : component.type === "time" ? "time"
                  : "text";
  return (
    <Input
      {...common}
      type={type}
      value={value == null ? "" : String(value)}
      placeholder={component.placeholder}
      min={component.min ?? component.validate?.min}
      max={component.max ?? component.validate?.max}
      step={component.step}
      spellCheck={readSetting(component, "spellcheck") !== false}
      autoComplete={typeof readSetting(component, "autocomplete") === "string" ? String(readSetting(component, "autocomplete")) : undefined}
      autoFocus={readSetting(component, "autofocus") === true}
      tabIndex={typeof readSetting(component, "tabindex") === "number" ? readSetting(component, "tabindex") as number : undefined}
      onChange={(e) => {
        if (type === "number") onChange(e.target.value === "" ? "" : Number(e.target.value));
        else onChange(normalizeText(component, e.target.value));
      }}
    />
  );
}

function GridEditor({
  component,
  rows,
  disabled,
  errors,
  path,
  onChange,
}: {
  component: FormComponent;
  rows: Record<string, unknown>[];
  disabled?: boolean;
  errors: Record<string, string>;
  path: string;
  onChange: (rows: Record<string, unknown>[]) => void;
}) {
  const cols = component.components ?? [];
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [filter, setFilter] = useState("");
  const [windowStart, setWindowStart] = useState(0);
  const update = (index: number, key: string, value: unknown) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };
  const needle = filter.trim().toLowerCase();
  const visible = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !needle || JSON.stringify(row).toLowerCase().includes(needle));
  if (sortKey) {
    visible.sort((a, b) => {
      const av = a.row[sortKey];
      const bv = b.row[sortKey];
      const an = Number(av);
      const bn = Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn) && String(av) !== "" && String(bv) !== "") return (an - bn) * sortDir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
    });
  }
  const windowSize = 40;
  const start = Math.min(windowStart, Math.max(0, visible.length - 1));
  const pageRows = visible.slice(start, start + windowSize);
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <div className="flex items-center gap-2 border-b border-line px-2 py-2">
        <input className="h-9 w-full max-w-xs rounded-md border border-line bg-elevated px-2 text-sm" value={filter} placeholder="Filter rows" aria-label="Filter rows" onChange={(event) => setFilter(event.target.value)} />
        <span className="text-xs text-muted">{visible.length} of {rows.length}</span>
        {visible.length > windowSize ? (
          <span className="flex gap-1">
            <Button variant="ghost" className="h-9 px-2" disabled={start === 0} onClick={() => setWindowStart(Math.max(0, start - windowSize))}>Previous rows</Button>
            <Button variant="ghost" className="h-9 px-2" disabled={start + windowSize >= visible.length} onClick={() => setWindowStart(start + windowSize)}>Next rows</Button>
          </span>
        ) : null}
      </div>
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead className="bg-paper text-left text-xs text-muted">
          <tr>
            {cols.map((col) => (
              <th key={col.id} className="px-2 py-2 font-medium">
                <button type="button" className="inline-flex h-8 items-center" onClick={() => {
                  if (sortKey === col.key) setSortDir((dir) => (dir === 1 ? -1 : 1));
                  else { setSortKey(col.key); setSortDir(1); }
                }}>{col.label}{sortKey === col.key ? (sortDir === 1 ? " ↑" : " ↓") : ""}</button>
              </th>
            ))}
            <th className="w-28 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {pageRows.map(({ row, index }) => (
            <tr key={index} className="border-t border-line">
              {cols.map((col) => (
                <td key={col.id} className="px-2 py-2 align-top">
                  <FieldInput component={col} value={row[col.key]} disabled={disabled || !!col.calculateValue} error={errors[`${path}.${index}.${col.key}`]} onChange={(next) => update(index, col.key, next)} />
                </td>
              ))}
              <td className="px-2 py-2">
                <div className="flex gap-1">
                  <Button variant="ghost" className="h-9 px-2" disabled={disabled || index === 0} onClick={() => {
                    const next = rows.slice();
                    const [item] = next.splice(index, 1);
                    if (item) next.splice(index - 1, 0, item);
                    onChange(next);
                  }}>Up</Button>
                  <Button variant="ghost" className="h-9 px-2" disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== index))}>Remove</Button>
                </div>
              </td>
            </tr>
          ))}
          <tr className="border-t border-line text-xs text-muted">
            {cols.map((col) => {
              if (col.type !== "number" && col.type !== "currency") return <td key={col.id} className="px-2 py-2" />;
              const nums = rows.map((row) => Number(row[col.key])).filter((n) => Number.isFinite(n));
              const sum = nums.reduce((a, b) => a + b, 0);
              const avg = nums.length ? sum / nums.length : 0;
              return <td key={col.id} className="px-2 py-2 tabular-nums">Σ {sum} · avg {Number(avg.toFixed(2))}</td>;
            })}
            <td />
          </tr>
        </tbody>
      </table>
      <div className="border-t border-line p-2">
        <Button variant="secondary" className="h-9" disabled={disabled} onClick={() => onChange([...rows, {}])}>Add row</Button>
      </div>
    </div>
  );
}

function Fields({
  components,
  data,
  root,
  errors,
  disabled,
  onChange,
  reviewSource,
}: {
  components: FormComponent[];
  data: Record<string, unknown>;
  root: Record<string, unknown>;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (data: Record<string, unknown>) => void;
  reviewSource: FormDefinition;
}) {
  return (
    <div className="grid gap-4">
      {components.map((component) => {
        if (component.type === "hidden" || !isVisible(component, root)) return null;
        if (component.type === "content" || upstreamType(component) === "htmlelement") {
          const html = typeof readSetting(component, "content") === "string" ? String(readSetting(component, "content")) : typeof readSetting(component, "html") === "string" ? String(readSetting(component, "html")) : "";
          if (html && upstreamType(component) === "htmlelement") {
            return <div key={component.id} className="text-sm text-muted" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
          }
          return (
            <p key={component.id} className={cn("text-sm text-muted", component.variant === "alert" && "rounded-lg border border-line bg-paper px-3 py-2", component.variant === "heading" && "text-lg font-semibold text-paper-fg")}>
              {component.description || component.label}
            </p>
          );
        }
        if (component.type === "button") return null;
        if (component.type === "review") {
          const rows = reviewRows(reviewSource.components, root, root);
          return (
            <div key={component.id} className="grid gap-2 rounded-lg border border-line p-3">
              <p className="text-sm font-medium">{component.label}</p>
              {component.description ? <p className="text-xs text-muted">{component.description}</p> : null}
              {rows.length === 0 ? <p className="text-sm text-muted">Nothing to review yet.</p> : null}
              <dl className="grid gap-2">
                {rows.map((row) => (
                  <div key={row.label} className="grid gap-0.5">
                    <dt className="text-xs text-muted">{row.label}</dt>
                    <dd className="text-sm">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        }
        if (component.type === "panel" || component.type === "fieldset") {
          return (
            <fieldset key={component.id} className="grid gap-3 rounded-lg border border-line p-3">
              <legend className="px-1 text-sm font-medium">{component.label}</legend>
              <Fields components={component.components ?? []} data={data} root={root} errors={errors} disabled={disabled} onChange={onChange} reviewSource={reviewSource} />
            </fieldset>
          );
        }
        if (component.type === "tabs") {
          return <TabGroup key={component.id} component={component} data={data} root={root} errors={errors} disabled={disabled} onChange={onChange} reviewSource={reviewSource} />;
        }
        if (component.type === "columns") {
          return (
            <div key={component.id} className="grid gap-4 md:grid-cols-2">
              {component.columns?.map((col, index) => (
                <Fields key={index} components={col.components} data={data} root={root} errors={errors} disabled={disabled} onChange={onChange} reviewSource={reviewSource} />
              ))}
            </div>
          );
        }
        if (component.type === "container") {
          const obj = (data[component.key] && typeof data[component.key] === "object" ? data[component.key] : {}) as Record<string, unknown>;
          return (
            <fieldset key={component.id} className="grid gap-3 rounded-lg border border-dashed border-line p-3">
              <legend className="px-1 text-sm font-medium">{component.label}</legend>
              <Fields
                components={component.components ?? []}
                data={obj}
                root={root}
                errors={errors}
                disabled={disabled}
                reviewSource={reviewSource}
                onChange={(next) => onChange({ ...data, [component.key]: next })}
              />
            </fieldset>
          );
        }
        if (component.type === "datagrid") {
          const rows = Array.isArray(data[component.key]) ? data[component.key] as Record<string, unknown>[] : [];
          return (
            <div key={component.id} className="grid gap-2">
              <p className="text-sm font-medium">{component.label}</p>
              {errors[component.key] ? <p className="text-xs text-danger">{errors[component.key]}</p> : null}
              <GridEditor component={component} rows={rows} disabled={disabled} errors={errors} path={component.key} onChange={(next) => onChange({ ...data, [component.key]: next })} />
            </div>
          );
        }
        return (
          <FieldShell key={component.id} component={component} value={data[component.key]} error={errors[component.key]}>
            <FieldInput
              component={component}
              value={data[component.key]}
              disabled={disabled || !!component.calculateValue || component.disabled}
              error={errors[component.key]}
              onChange={(next) => onChange({ ...data, [component.key]: next })}
            />
          </FieldShell>
        );
      })}
    </div>
  );
}

function TabGroup(props: {
  component: FormComponent;
  data: Record<string, unknown>;
  root: Record<string, unknown>;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (data: Record<string, unknown>) => void;
  reviewSource: FormDefinition;
}) {
  const tabs = props.component.components ?? [];
  const [active, setActive] = useState(0);
  const current = tabs[active] ?? tabs[0];
  return (
    <div className="grid gap-3">
      <div className="flex gap-1 overflow-x-auto" role="tablist">
        {tabs.map((tab, index) => (
          <button key={tab.id} type="button" role="tab" aria-selected={index === active} className={cn("h-10 shrink-0 rounded-md px-3 text-sm", index === active ? "bg-accent text-accent-fg" : "bg-paper")} onClick={() => setActive(index)}>
            {tab.label}
          </button>
        ))}
      </div>
      {current ? <Fields components={current.components ?? []} data={props.data} root={props.root} errors={props.errors} disabled={props.disabled} onChange={props.onChange} reviewSource={props.reviewSource} /> : null}
    </div>
  );
}

export function FormRuntime({ form, frame = "full", initial, onSubmit, onDraft }: Props) {
  const seed = useMemo(() => applyCalculations(form.components, { ...initialData(form.components), ...(initial ?? {}) }), [form, initial]);
  const [data, setData] = useState<Record<string, unknown>>(seed);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const skipScroll = useRef(true);
  const pages = form.display === "wizard" ? pageComponents(form) : [];
  const wizard = form.display === "wizard" && pages.length > 1 && pages.every((item) => item.type === "panel" || item.type === "fieldset");
  const visiblePages = wizard ? pages.filter((item) => isVisible(item, data)) : [];
  const safePage = Math.min(page, Math.max(0, visiblePages.length - 1));
  const current = wizard ? visiblePages[safePage] ?? null : null;

  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [safePage]);

  const commit = (next: Record<string, unknown>) => {
    setData(applyClearOnHide(form.components, applyCalculations(form.components, next)));
    setErrors({});
    setMessage("");
  };

  const submit = async () => {
    const computed = applyClearOnHide(form.components, applyCalculations(form.components, data));
    const found = validateForm(form, computed);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage(errorSummary(found));
      revealError();
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit(publicSubmission(form.components, computed));
      if (result.errors && Object.keys(result.errors).length) {
        setErrors(result.errors);
        setMessage(result.message || errorSummary(result.errors));
        revealError();
        return;
      }
      setMessage(result.message || form.settings.successMessage);
    } finally {
      setBusy(false);
    }
  };

  const nextPage = () => {
    if (!current) return;
    const found = validatePage(current, data);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage(errorSummary(found));
      revealError();
      return;
    }
    setMessage("");
    setPage((value) => Math.min(visiblePages.length - 1, value + 1));
  };

  const goToPage = (index: number) => {
    if (index === safePage) return;
    if (index < safePage) {
      setErrors({});
      setMessage("");
      setPage(index);
      return;
    }
    if (index === safePage + 1) nextPage();
  };

  const body = current ? (
    <Fields components={current.components ?? []} data={data} root={data} errors={errors} onChange={commit} reviewSource={form} />
  ) : (
    <Fields components={form.components} data={data} root={data} errors={errors} onChange={commit} reviewSource={form} />
  );

  return (
    <div className={cn("mx-auto flex h-full min-h-0 w-full flex-col", frame === "phone" ? "max-w-sm" : frame === "tablet" ? "max-w-xl" : "max-w-3xl")}>
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto px-1 py-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{form.title}</h1>
          {form.description ? <p className="mt-1 text-sm text-muted">{form.description}</p> : null}
        </header>
        {wizard ? (
          <ol className="mt-6 flex gap-2 overflow-x-auto text-xs" aria-label="Progress">
            {visiblePages.map((item, index) => {
              const locked = index > safePage + 1;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={locked}
                    aria-current={index === safePage ? "step" : undefined}
                    className={cn(
                      "h-9 rounded-md px-2.5",
                      index === safePage ? "bg-accent text-accent-fg" : "bg-paper text-muted",
                      locked && "opacity-40",
                    )}
                    onClick={() => goToPage(index)}
                  >
                    {index + 1}. {item.label}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}
        <div className="mt-6">{body}</div>
      </div>
      <div className="shrink-0 border-t border-line bg-paper px-1 py-3">
        {message ? <p role="alert" className={cn("mb-2 text-sm", message === form.settings.successMessage ? "text-ok" : "text-danger")}>{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          {wizard && safePage > 0 ? <Button variant="secondary" onClick={() => goToPage(safePage - 1)}>Previous</Button> : null}
          {wizard && safePage < visiblePages.length - 1 ? <Button onClick={nextPage}>Next</Button> : (
            <Button disabled={busy} onClick={() => void submit()}>{busy ? "Submitting…" : form.settings.submitLabel || "Submit"}</Button>
          )}
          {form.settings.allowDraft && onDraft ? (
            <Button variant="secondary" onClick={() => onDraft(applyCalculations(form.components, data))}>{form.settings.draftLabel || "Save draft"}</Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function errorSummary(found: Record<string, string>): string {
  const msgs = Object.values(found);
  if (msgs.length === 0) return "This page still has errors.";
  if (msgs.length === 1) return msgs[0] ?? "This page still has errors.";
  return msgs.slice(0, 3).join(" · ");
}

function revealError() {
  requestAnimationFrame(() => {
    const node = document.querySelector<HTMLElement>("[aria-invalid='true']");
    node?.scrollIntoView({ block: "center" });
    node?.focus();
  });
}
