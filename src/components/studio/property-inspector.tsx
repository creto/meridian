import { useMemo, useState } from "react";
import { applicableSettings, filterSettings, tabsFor, upstreamType, type FormioSetting, type SettingFilter } from "@/lib/forms/formio/adapter";
import { classifySetting } from "@/lib/forms/formio/parity-status";
import {
  componentJson,
  duplicateKey,
  readSetting,
  referenceWarnings,
  settingVisible,
  validateSettingPair,
  validateSettingValue,
  writeSetting,
} from "@/lib/forms/formio/document";
import { importFormioNode } from "@/lib/forms/formio-registry";
import type { FormComponent } from "@/lib/forms/types";

function statusLabel(status: string): string {
  if (status === "FULL") return "Runtime";
  if (status === "PARTIAL") return "Stored";
  if (status === "INTENTIONALLY_UNSUPPORTED") return "Not executed";
  return "n/a";
}

function Control({
  setting,
  value,
  onChange,
}: {
  setting: FormioSetting;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = setting.label || setting.key;
  if (setting.editorType === "checkbox") {
    return (
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }
  if (setting.editorType === "select" || setting.editorType === "radio" || setting.editorType === "selectboxes") {
    const options = setting.options ?? [];
    return (
      <label className="grid gap-1">{label}
        <select className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2" value={value == null ? "" : String(value)} onChange={(event) => onChange(event.target.value)}>
          <option value="">Default</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    );
  }
  if (setting.editorType === "number" || setting.editorType === "currency") {
    return (
      <label className="grid gap-1">{label}
        <input type="number" className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2" value={value == null || value === "" ? "" : String(value)} placeholder={setting.placeholder} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} />
      </label>
    );
  }
  if (setting.editorType === "textarea" || setting.editor === "ace" || setting.editor === "ace" || setting.key.endsWith(".json") || setting.key === "html" || setting.key === "content") {
    return (
      <label className="grid gap-1">{label}
        <textarea className="min-h-24 rounded-md border border-chrome-line bg-chrome-elev px-2 py-2 font-mono text-xs" rows={setting.rows ?? 4} value={typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2)} placeholder={setting.placeholder} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }
  if (setting.editorType === "datagrid" || setting.editorType === "editgrid" || setting.editorType === "datamap") {
    return <GridSetting setting={setting} value={value} onChange={onChange} />;
  }
  return (
    <label className="grid gap-1">{label}
      <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2" value={value == null ? "" : String(value)} placeholder={setting.placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function GridSetting({ setting, value, onChange }: { setting: FormioSetting; value: unknown; onChange: (value: unknown) => void }) {
  const rows = Array.isArray(value) ? value as Record<string, unknown>[] : [];
  const fields = (setting.itemFields ?? []).filter((field) => field.key && !field.help);
  const columns = fields.length ? fields : [
    { key: "label", label: "Label", tab: setting.tab, editorType: "textfield" },
    { key: "value", label: "Value", tab: setting.tab, editorType: "textfield" },
  ];
  const update = (index: number, key: string, next: unknown) => {
    const copy = rows.map((row) => ({ ...row }));
    const current = copy[index] ?? {};
    current[key] = next;
    copy[index] = current;
    onChange(copy);
  };
  return (
    <fieldset className="grid gap-2 rounded-md border border-chrome-line p-2">
      <legend className="px-1 text-xs text-chrome-muted">{setting.label || setting.key}</legend>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-1 border-b border-chrome-line pb-2">
          {columns.slice(0, 6).map((field) => (
            <label key={field.key} className="grid gap-1 text-xs">{field.label || field.key}
              <input className="h-9 rounded-md border border-chrome-line bg-chrome-elev px-2 text-sm" value={row[field.key] == null ? "" : String(row[field.key])} onChange={(event) => update(index, field.key, event.target.value)} />
            </label>
          ))}
          <button type="button" className="h-8 justify-self-start text-xs underline" onClick={() => onChange(rows.filter((_, item) => item !== index))}>Remove</button>
        </div>
      ))}
      <button type="button" className="h-9 rounded-md border border-chrome-line text-xs" onClick={() => onChange([...rows, {}])}>Add</button>
    </fieldset>
  );
}

export function PropertyInspector({
  component,
  siblings,
  onChange,
}: {
  component: FormComponent;
  siblings: FormComponent[];
  onChange: (next: FormComponent) => void;
}) {
  const type = upstreamType(component);
  const tabs = useMemo(() => tabsFor(type), [type]);
  const [tab, setTab] = useState(tabs[0]?.key ?? "display");
  const [filter, setFilter] = useState<SettingFilter>("basic");
  const [query, setQuery] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [notice, setNotice] = useState("");
  const active = tabs.find((item) => item.key === tab) ?? tabs[0];
  const pool = query.trim() ? applicableSettings(type) : active?.settings ?? [];
  const visible = filterSettings(pool, filter, query).filter((setting) => settingVisible(component, setting.conditional));
  const counts = useMemo(() => {
    const all = applicableSettings(type);
    return { all: all.length, basic: filterSettings(all, "basic", "").length };
  }, [type]);

  const commit = (path: string, value: unknown) => {
    const issue = validateSettingValue(path, value);
    if (issue) {
      setNotice(issue);
      return;
    }
    if (path === "key" && typeof value === "string" && duplicateKey(siblings, component.id, value)) {
      setNotice(`Another field already uses “${value}”.`);
      return;
    }
    const previousKey = component.key;
    const next = writeSetting(component, path, value);
    const pair = validateSettingPair(next);
    if (pair) {
      setNotice(pair);
      return;
    }
    setNotice("");
    onChange(next);
    if (path === "key" && typeof value === "string") {
      const warnings = referenceWarnings(siblings, previousKey, value);
      if (warnings.length) setNotice(warnings.join(" "));
    }
  };

  const showJson = tab === "json";
  return (
    <div className="grid gap-3 p-3 text-sm">
      <div>
        <p className="text-sm font-medium text-chrome-fg">{component.label || type}</p>
        <p className="text-xs text-chrome-muted">{type} · {counts.all} settings · {counts.basic} basic</p>
      </div>
      <label className="grid gap-1 text-xs">Classification
        <select className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2 text-sm" value={component.classification ?? "PUBLIC"} onChange={(event) => onChange({ ...component, classification: event.target.value as FormComponent["classification"] })}>
          {["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs">Safe show-when
        <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2 font-mono text-xs" value={component.conditional ?? ""} placeholder='country == "CO"' aria-label="Safe show-when expression" onChange={(event) => onChange({ ...component, conditional: event.target.value || undefined })} />
      </label>
      <label className="grid gap-1 text-xs">Search settings
        <input className="h-10 rounded-md border border-chrome-line bg-chrome-elev px-2 text-sm" value={query} placeholder="mask, clear, api…" aria-label="Search settings" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="flex gap-1" role="group" aria-label="Setting depth">
        {(["basic", "advanced", "all"] as const).map((item) => (
          <button key={item} type="button" className={`h-8 flex-1 rounded-md capitalize ${filter === item ? "bg-chrome-elev text-chrome-fg" : "text-chrome-muted"}`} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Setting groups" onKeyDown={(event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        const keys = [...tabs.map((item) => item.key), "json"];
        const index = keys.indexOf(showJson ? "json" : tab);
        const next = event.key === "ArrowRight" ? keys[(index + 1) % keys.length] : keys[(index - 1 + keys.length) % keys.length];
        setTab(next ?? "display");
      }}>
        {tabs.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={item.key === tab} className={`h-8 shrink-0 rounded-md px-2 text-xs ${item.key === tab ? "bg-chrome-elev text-chrome-fg" : "text-chrome-muted"}`} onClick={() => setTab(item.key)}>{item.label}</button>
        ))}
        <button type="button" role="tab" aria-selected={showJson} className={`h-8 shrink-0 rounded-md px-2 text-xs ${showJson ? "bg-chrome-elev text-chrome-fg" : "text-chrome-muted"}`} onClick={() => { setJsonText(JSON.stringify(componentJson(component), null, 2)); setJsonError(""); setTab("json"); }}>JSON</button>
      </div>
      {notice ? <p className="text-xs text-chrome-muted" role="status">{notice}</p> : null}
      {showJson ? (
        <div className="grid gap-2">
          <textarea className="min-h-64 rounded-md border border-chrome-line bg-chrome-elev px-2 py-2 font-mono text-xs" aria-label="Component JSON" value={jsonText} onChange={(event) => setJsonText(event.target.value)} />
          {jsonError ? <p className="text-xs text-danger" role="alert">{jsonError}</p> : null}
          <div className="flex gap-2">
            <button type="button" className="h-9 rounded-md border border-chrome-line px-2 text-xs" onClick={() => {
              try {
                setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
                setJsonError("");
              } catch (error) {
                setJsonError(error instanceof Error ? error.message : "Invalid JSON");
              }
            }}>Format</button>
            <button type="button" className="h-9 rounded-md bg-chrome-elev px-2 text-xs" onClick={() => {
              try {
                const parsed = JSON.parse(jsonText) as Record<string, unknown>;
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                  setJsonError("Component JSON must be an object.");
                  return;
                }
                const imported = importFormioNode(parsed).component;
                imported.id = component.id;
                setJsonError("");
                onChange(imported);
              } catch (error) {
                setJsonError(error instanceof Error ? error.message : "Invalid JSON");
              }
            }}>Apply JSON</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.length === 0 ? <p className="text-xs text-chrome-muted">No settings match.</p> : null}
          {visible.map((setting, index) => {
            const parity = classifySetting(type, setting);
            const value = readSetting(component, setting.key);
            return (
              <div key={`${setting.tab}:${setting.key}:${index}`} className="grid gap-1">
                <Control setting={setting} value={value} onChange={(next) => commit(setting.key, next)} />
                <p className="text-[11px] text-chrome-muted">
                  <span className="font-mono">{setting.key}</span>
                  {" · "}
                  {statusLabel(parity.status)}
                  {setting.tooltip ? ` — ${setting.tooltip}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
