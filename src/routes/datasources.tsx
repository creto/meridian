import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/shell";
import { Button, Input } from "@/components/ui/primitives";
import { countryDepartmentCity, runCascade } from "@/lib/datasources/runner";

export const Route = createFileRoute("/datasources")({ component: DataSourcePage });

const levels = countryDepartmentCity({
  countries: [{ label: "Colombia", value: "CO" }, { label: "Mexico", value: "MX" }],
  departments: {
    CO: [{ label: "Cundinamarca", value: "CUN" }, { label: "Antioquia", value: "ANT" }],
    MX: [{ label: "Jalisco", value: "JAL" }],
  },
  cities: {
    CUN: [{ label: "Bogota", value: "BOG" }],
    ANT: [{ label: "Medellin", value: "MED" }],
    JAL: [{ label: "Guadalajara", value: "GDL" }],
  },
});

function DataSourcePage() {
  const [country, setCountry] = useState("");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [options, setOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({});
  const [error, setError] = useState<string | null>(null);

  async function load(next: { country: string; department: string; city: string }) {
    setError(null);
    try {
      const result = await runCascade(levels, next, {
        fetch: async () => ({ ok: true, status: 200, body: [] }),
        now: () => Date.now(),
        cache: new Map(),
        secrets: {},
      });
      setOptions(result.options);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lookup failed");
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-xl gap-4 px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Data sources</h1>
        <p className="text-sm text-muted">Country, department, and city. A later choice is cleared when its parent changes. This catalog is local. REST sources are checked for blocked addresses before a request leaves the server.</p>
        <label className="grid gap-1 text-sm">Country
          <select className="h-11 rounded-md border border-line bg-elevated px-3" value={country} onChange={(event) => {
            const value = event.target.value;
            setCountry(value);
            setDepartment("");
            setCity("");
            void load({ country: value, department: "", city: "" });
          }}>
            <option value="">Select</option>
            {(options.country ?? levels[0]?.config.staticItems ?? []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Department
          <select className="h-11 rounded-md border border-line bg-elevated px-3" value={department} onChange={(event) => {
            const value = event.target.value;
            setDepartment(value);
            setCity("");
            void load({ country, department: value, city: "" });
          }}>
            <option value="">Select</option>
            {(options.department ?? []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">City
          <select className="h-11 rounded-md border border-line bg-elevated px-3" value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">Select</option>
            {(options.city ?? []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <Input aria-label="REST URL" placeholder="https://example.com/cities" />
        <Button onClick={() => void load({ country, department, city })}>Refresh</Button>
        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
        <p className="text-sm">Selected {country || "—"} / {department || "—"} / {city || "—"}</p>
      </main>
    </div>
  );
}
