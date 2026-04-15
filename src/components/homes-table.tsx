"use client";

import type { HomeRecord } from "@/lib/homes";
import {
  filterHomesByQuery,
  formatLivingAreaSqft,
  formatPercentChange,
  formatUsd,
  getLatestAppraisal,
  getTravisCadPropertyUrl,
  getYoYChangePercent,
  uniqNonEmpty,
} from "@/lib/homes";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type SortKey =
  | "street"
  | "builder"
  | "squareFeet"
  | "homestead"
  | "solar"
  | "pool"
  | "appraisedValue"
  | "yoyPercent";
type SortDir = "asc" | "desc";

type ColKey = "address" | "builder" | "squareFeet" | "homestead" | "solar" | "pool" | "appraisal" | "yoy" | "cad";

const COL_LABELS: Record<ColKey, string> = {
  address: "Address",
  builder: "Builder",
  squareFeet: "Sq ft",
  homestead: "Homestead",
  solar: "Solar",
  pool: "Pool",
  appraisal: "Appraisal",
  yoy: "YoY",
  cad: "CAD",
};

const DEFAULT_COLS: Record<ColKey, boolean> = {
  address: true,
  builder: true,
  squareFeet: true,
  homestead: true,
  solar: true,
  pool: true,
  appraisal: true,
  yoy: true,
  cad: true,
};

const COLS_STORAGE_KEY = "homesTableVisibleCols";

function loadColsFromStorage(): Record<ColKey, boolean> {
  if (typeof window === "undefined") return { ...DEFAULT_COLS };
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COLS };
    const parsed = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
    return { ...DEFAULT_COLS, ...parsed, address: true };
  } catch {
    return { ...DEFAULT_COLS };
  }
}

function triStateFromParam(v: string | null): "yes" | "no" | "any" {
  if (v === "yes" || v === "no") return v;
  return "any";
}

function formatYesNo(v: "yes" | "no" | null | undefined): string {
  if (v === "yes") return "Yes";
  if (v === "no") return "No";
  return "—";
}

function cmp(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function cmpYesNoField(a: HomeRecord, b: HomeRecord, field: "homestead" | "solar" | "pool"): number {
  const score = (h: HomeRecord) => {
    const v = h[field];
    if (v === "yes") return 2;
    if (v === "no") return 1;
    return 0;
  };
  return score(a) - score(b);
}

function sortHomes(homes: HomeRecord[], key: SortKey, dir: SortDir): HomeRecord[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...homes].sort((x, y) => {
    if (key === "street") return mul * cmp(x.street ?? "", y.street ?? "");
    if (key === "builder") return mul * cmp(x.builder ?? "", y.builder ?? "");
    if (key === "squareFeet") {
      const ax = typeof x.squareFeet === "number" && Number.isFinite(x.squareFeet) ? x.squareFeet : 0;
      const ay = typeof y.squareFeet === "number" && Number.isFinite(y.squareFeet) ? y.squareFeet : 0;
      return mul * (ax - ay);
    }
    if (key === "homestead") return mul * cmpYesNoField(x, y, "homestead");
    if (key === "solar") return mul * cmpYesNoField(x, y, "solar");
    if (key === "pool") return mul * cmpYesNoField(x, y, "pool");
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
    return 0;
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

function formatStreetOnly(h: HomeRecord): string {
  const s = (h.street ?? "").trim();
  return s || (h.raw ?? "").trim() || "—";
}

const TRI_FILTERS = [
  { param: "homestead" as const, label: "Homestead" },
  { param: "solar" as const, label: "Solar" },
  { param: "pool" as const, label: "Pool" },
];

export function HomesTable({ homes }: { homes: HomeRecord[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("street");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [cols, setCols] = useState<Record<ColKey, boolean>>(DEFAULT_COLS);

  useEffect(() => {
    setCols(loadColsFromStorage());
  }, []);

  const persistCols = useCallback((next: Record<ColKey, boolean>) => {
    const merged = { ...next, address: true };
    setCols(merged);
    try {
      localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  }, []);

  const builders = useMemo(() => uniqNonEmpty(homes.map((h) => h.builder)), [homes]);

  const homesteadFilter = triStateFromParam(searchParams.get("homestead"));
  const solarFilter = triStateFromParam(searchParams.get("solar"));
  const poolFilter = triStateFromParam(searchParams.get("pool"));
  const builderParam = searchParams.get("builder")?.trim();
  const builderFilter = builderParam && builderParam.length > 0 ? builderParam : "any";

  const setTriParam = useCallback(
    (param: "homestead" | "solar" | "pool", value: "yes" | "no" | "any") => {
      const p = new URLSearchParams(searchParams.toString());
      if (value === "any") p.delete(param);
      else p.set(param, value);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setBuilderParam = useCallback(
    (value: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value === "any") p.delete("builder");
      else p.set("builder", value);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const filtered = useMemo(() => {
    let out = filterHomesByQuery(homes, query);
    if (homesteadFilter !== "any") out = out.filter((h) => h.homestead === homesteadFilter);
    if (solarFilter !== "any") out = out.filter((h) => h.solar === solarFilter);
    if (poolFilter !== "any") out = out.filter((h) => h.pool === poolFilter);
    if (builderFilter !== "any") out = out.filter((h) => (h.builder ?? "") === builderFilter);
    return sortHomes(out, sortKey, sortDir);
  }, [homes, query, homesteadFilter, solarFilter, poolFilter, builderFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  const visibleCount = useMemo(
    () => (Object.entries(cols) as [ColKey, boolean][]).filter(([, v]) => v).length,
    [cols],
  );

  const builderOptions = useMemo(() => {
    const set = new Set(builders);
    if (builderFilter !== "any" && !set.has(builderFilter)) {
      return [...builders, builderFilter].sort((a, b) => a.localeCompare(b));
    }
    return builders;
  }, [builders, builderFilter]);

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
              placeholder="Search (street, builder, appraisal…)…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <p className="text-xs text-slate-500">
            Showing <span className="font-medium tabular-nums">{filtered.length}</span> of{" "}
            <span className="font-medium tabular-nums">{homes.length}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {TRI_FILTERS.map(({ param, label }) => {
            const value =
              param === "homestead" ? homesteadFilter : param === "solar" ? solarFilter : poolFilter;
            return (
              <label key={param} className="grid gap-1 text-xs font-medium text-ink-muted">
                {label}
                <select
                  value={value}
                  onChange={(e) =>
                    setTriParam(param, e.target.value as "yes" | "no" | "any")
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="any">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            );
          })}

          <label className="grid gap-1 text-xs font-medium text-ink-muted">
            Builder
            <select
              value={builderFilter}
              onChange={(e) => setBuilderParam(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="any">Any</option>
              {builderOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <details className="relative rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <summary className="cursor-pointer list-none font-medium text-ink [&::-webkit-details-marker]:hidden">
              Columns
            </summary>
            <div className="absolute right-0 z-10 mt-2 min-w-[12rem] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
              <p className="mb-2 text-xs text-ink-muted">Show or hide table columns.</p>
              <ul className="space-y-2">
                {(Object.keys(COL_LABELS) as ColKey[])
                  .filter((k) => k !== "address")
                  .map((key) => (
                    <li key={key}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={cols[key]}
                          onChange={(e) => persistCols({ ...cols, [key]: e.target.checked })}
                          className="rounded border-slate-300 text-accent focus:ring-accent"
                        />
                        {COL_LABELS[key]}
                      </label>
                    </li>
                  ))}
              </ul>
            </div>
          </details>

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
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                {cols.address && (
                  <th scope="col" className="px-4 py-3 text-left">
                    <Th
                      label="Address"
                      active={sortKey === "street"}
                      dir={sortDir}
                      onClick={() => toggleSort("street")}
                    />
                  </th>
                )}
                {cols.builder && (
                  <th scope="col" className="px-4 py-3 text-left">
                    <Th
                      label="Builder"
                      active={sortKey === "builder"}
                      dir={sortDir}
                      onClick={() => toggleSort("builder")}
                    />
                  </th>
                )}
                {cols.squareFeet && (
                  <th scope="col" className="px-4 py-3 text-left">
                    <Th
                      label="Sq ft"
                      active={sortKey === "squareFeet"}
                      dir={sortDir}
                      onClick={() => toggleSort("squareFeet")}
                    />
                  </th>
                )}
                {cols.homestead && (
                  <th scope="col" className="px-4 py-3 text-left">
                    <Th
                      label="Homestead"
                      active={sortKey === "homestead"}
                      dir={sortDir}
                      onClick={() => toggleSort("homestead")}
                    />
                  </th>
                )}
                {cols.solar && (
                  <th scope="col" className="px-4 py-3 text-left">
                    <Th
                      label="Solar"
                      active={sortKey === "solar"}
                      dir={sortDir}
                      onClick={() => toggleSort("solar")}
                    />
                  </th>
                )}
                {cols.pool && (
                  <th scope="col" className="px-4 py-3 text-left">
                    <Th
                      label="Pool"
                      active={sortKey === "pool"}
                      dir={sortDir}
                      onClick={() => toggleSort("pool")}
                    />
                  </th>
                )}
                {cols.appraisal && (
                  <th scope="col" className="px-4 py-3 text-left">
                    <Th
                      label="Appraisal"
                      active={sortKey === "appraisedValue"}
                      dir={sortDir}
                      onClick={() => toggleSort("appraisedValue")}
                    />
                  </th>
                )}
                {cols.yoy && (
                  <th scope="col" className="px-4 py-3 text-left">
                    <Th
                      label="YoY"
                      active={sortKey === "yoyPercent"}
                      dir={sortDir}
                      onClick={() => toggleSort("yoyPercent")}
                    />
                  </th>
                )}
                {cols.cad && (
                  <th scope="col" className="px-4 py-3 text-left">
                    <span className="font-semibold text-ink">CAD</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id} className="border-b border-slate-100 last:border-b-0">
                  {cols.address && (
                    <td className="px-4 py-3 font-medium text-ink">
                      <Link
                        href={`/homes/${encodeURIComponent(h.id)}`}
                        className="text-accent-dark underline decoration-slate-200 underline-offset-2 hover:decoration-accent-dark"
                      >
                        {formatStreetOnly(h)}
                      </Link>
                    </td>
                  )}
                  {cols.builder && (
                    <td className="px-4 py-3 text-ink-muted">{h.builder?.trim() ? h.builder : "—"}</td>
                  )}
                  {cols.squareFeet && (
                    <td className="px-4 py-3 text-ink-muted tabular-nums">{formatLivingAreaSqft(h)}</td>
                  )}
                  {cols.homestead && (
                    <td className="px-4 py-3 text-ink-muted">{formatYesNo(h.homestead)}</td>
                  )}
                  {cols.solar && (
                    <td className="px-4 py-3 text-ink-muted">{formatYesNo(h.solar)}</td>
                  )}
                  {cols.pool && (
                    <td className="px-4 py-3 text-ink-muted">{formatYesNo(h.pool)}</td>
                  )}
                  {cols.appraisal && (
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
                  )}
                  {cols.yoy && (
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
                  )}
                  {cols.cad && (
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
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-ink-muted" colSpan={Math.max(1, visibleCount)}>
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
