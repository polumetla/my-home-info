"use client";

import type { HomeRecord } from "@/lib/homes";
import {
  filterHomesByQuery,
  formatAddress,
  formatPercentChange,
  formatUsd,
  getLatestAppraisal,
  getTravisCadPropertyUrl,
  getYoYChangePercent,
  uniqNonEmpty,
} from "@/lib/homes";
import Link from "next/link";
import { useMemo, useState } from "react";

type SortKey =
  | "street"
  | "septicField"
  | "builder"
  | "yearBuilt"
  | "appraisedValue"
  | "yoyPercent";
type SortDir = "asc" | "desc";

function cmp(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function sortHomes(homes: HomeRecord[], key: SortKey, dir: SortDir): HomeRecord[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...homes].sort((x, y) => {
    if (key === "street") return mul * cmp(x.street ?? "", y.street ?? "");
    if (key === "builder") return mul * cmp(x.builder ?? "", y.builder ?? "");
    if (key === "yearBuilt") return mul * ((x.yearBuilt ?? 0) - (y.yearBuilt ?? 0));
    if (key === "appraisedValue") {
      const ax = getLatestAppraisal(x)?.value ?? 0;
      const ay = getLatestAppraisal(y)?.value ?? 0;
      return mul * (ax - ay);
    }
    if (key === "yoyPercent") {
      const ax = getYoYChangePercent(x);
      const ay = getYoYChangePercent(y);
      if (ax == null && ay == null) return 0;
      if (ax == null) return 1;
      if (ay == null) return -1;
      return mul * (ax - ay);
    }
    return mul * ((x.septicField ?? 0) - (y.septicField ?? 0));
  });
}

function Th({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2 text-left font-semibold text-ink"
    >
      <span>{label}</span>
      <span
        className={`text-xs tabular-nums ${
          active ? "text-ink" : "text-slate-300 group-hover:text-slate-400"
        }`}
        aria-hidden
      >
        {active ? (dir === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </button>
  );
}

export function HomesTable({ homes }: { homes: HomeRecord[] }) {
  const [query, setQuery] = useState("");
  const [septic, setSeptic] = useState<string>("any");
  const [builder, setBuilder] = useState<string>("any");
  const [sortKey, setSortKey] = useState<SortKey>("street");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const builders = useMemo(() => uniqNonEmpty(homes.map((h) => h.builder)), [homes]);
  const septicFields = useMemo(() => {
    const set = new Set<number>();
    for (const h of homes) {
      if (typeof h.septicField === "number") set.add(h.septicField);
    }
    return [...set].sort((a, b) => a - b);
  }, [homes]);

  const filtered = useMemo(() => {
    let out = filterHomesByQuery(homes, query);
    if (septic !== "any") {
      const n = Number.parseInt(septic, 10);
      out = out.filter((h) => h.septicField === n);
    }
    if (builder !== "any") {
      out = out.filter((h) => (h.builder ?? "") === builder);
    }
    return sortHomes(out, sortKey, sortDir);
  }, [homes, query, septic, builder, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <label className="block">
            <span className="sr-only">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search (address, septic #, builder, year)…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <p className="text-xs text-slate-500">
            Showing <span className="font-medium tabular-nums">{filtered.length}</span> of{" "}
            <span className="font-medium tabular-nums">{homes.length}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Septic field
            <select
              value={septic}
              onChange={(e) => setSeptic(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="any">Any</option>
              {septicFields.map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Builder
            <select
              value={builder}
              onChange={(e) => setBuilder(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="any">Any</option>
              {builders.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <Link
            href="/homes/map"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark"
          >
            Map
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th scope="col" className="px-4 py-3 text-left">
                  <Th
                    label="Address"
                    active={sortKey === "street"}
                    dir={sortDir}
                    onClick={() => toggleSort("street")}
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  <Th
                    label="Septic"
                    active={sortKey === "septicField"}
                    dir={sortDir}
                    onClick={() => toggleSort("septicField")}
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  <Th
                    label="Builder"
                    active={sortKey === "builder"}
                    dir={sortDir}
                    onClick={() => toggleSort("builder")}
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  <Th
                    label="Year"
                    active={sortKey === "yearBuilt"}
                    dir={sortDir}
                    onClick={() => toggleSort("yearBuilt")}
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  <Th
                    label="Appraisal"
                    active={sortKey === "appraisedValue"}
                    dir={sortDir}
                    onClick={() => toggleSort("appraisedValue")}
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  <Th
                    label="YoY"
                    active={sortKey === "yoyPercent"}
                    dir={sortDir}
                    onClick={() => toggleSort("yoyPercent")}
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  <span className="font-semibold text-ink">CAD</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-ink">
                    <Link
                      href={`/homes/${encodeURIComponent(h.id)}`}
                      className="text-accent-dark underline decoration-slate-200 underline-offset-2 hover:decoration-accent-dark"
                    >
                      {formatAddress(h)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {typeof h.septicField === "number" ? `#${h.septicField}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{h.builder?.trim() ? h.builder : "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {typeof h.yearBuilt === "number" ? h.yearBuilt : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {(() => {
                      const latest = getLatestAppraisal(h);
                      if (!latest) return "—";
                      return (
                        <span className="inline-flex items-baseline gap-2">
                          <span className="font-medium text-ink">{formatUsd(latest.value)}</span>
                          <span className="text-xs text-slate-500">{latest.year}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {(() => {
                      const yoy = getYoYChangePercent(h);
                      if (yoy == null) return "—";
                      const up = yoy > 0;
                      const down = yoy < 0;
                      return (
                        <span
                          className={`tabular-nums ${
                            up ? "text-emerald-800" : down ? "text-rose-800" : "text-ink-muted"
                          }`}
                        >
                          {formatPercentChange(yoy)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {h.cadPropertyId?.trim() ? (
                      <a
                        href={getTravisCadPropertyUrl(h.cadPropertyId.trim())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-accent-dark underline decoration-slate-300 underline-offset-2 hover:decoration-accent-dark"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-ink-muted" colSpan={7}>
                    No matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

