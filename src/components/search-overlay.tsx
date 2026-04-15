"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import type { SchoolEntry } from "@/data/schools";
import type { HomeRecord } from "@/lib/homes";
import { formatAddress } from "@/lib/homes";
import type { NavItem } from "@/lib/site-config";
import { mainNav } from "@/lib/site-config";
import { includesAll, termsFrom } from "@/lib/search-utils";
import { useSiteSearch } from "@/components/site-search-provider";

type UtilityRow = {
  category: string;
  providerName: string | null;
  website: string | null;
  outageStatus: string | null;
  phone: string | null;
  billing: string | null;
};

type Bundle = {
  homes: HomeRecord[];
  utilities: UtilityRow[];
  schools: SchoolEntry[];
};

export function SearchOverlay() {
  const { q, panelOpen, closePanel } = useSiteSearch();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!panelOpen || bundle) return;
    let cancelled = false;
    setLoadError(null);
    void fetch("/api/search-data")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load search data");
        return r.json() as Promise<Bundle>;
      })
      .then((data) => {
        if (!cancelled) setBundle(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load results. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [panelOpen, bundle]);

  useEffect(() => {
    if (!panelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, closePanel]);

  const onBackdrop = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) closePanel();
    },
    [closePanel],
  );

  const terms = useMemo(() => termsFrom(q), [q]);
  const navMatches = useMemo(() => {
    if (!terms.length) return [...mainNav];
    return mainNav.filter((i) => includesAll(`${i.label} ${i.href}`, terms));
  }, [terms]);

  const homeMatches = useMemo(() => {
    if (!bundle || !terms.length) return [];
    return bundle.homes
      .map((h) => ({ h, text: `${formatAddress(h)} ${h.builder ?? ""} ${h.septicField ?? ""}` }))
      .filter((x) => includesAll(x.text, terms))
      .slice(0, 40);
  }, [bundle, terms]);

  const utilityMatches = useMemo(() => {
    if (!bundle || !terms.length) return [];
    return bundle.utilities
      .map((u) => ({
        u,
        text: `${u.category} ${u.providerName ?? ""} ${u.website ?? ""} ${u.phone ?? ""}`,
      }))
      .filter((x) => includesAll(x.text, terms))
      .slice(0, 40);
  }, [bundle, terms]);

  const schoolMatches = useMemo(() => {
    if (!bundle || !terms.length) return [];
    return bundle.schools
      .map((s) => ({
        s,
        text: `${s.name} ${s.grades} ${s.address ?? ""} ${s.website ?? ""}`,
      }))
      .filter((x) => includesAll(x.text, terms))
      .slice(0, 40);
  }, [bundle, terms]);

  const hasQuery = q.trim().length > 0;

  const hasAnySearchResults =
    hasQuery &&
    bundle &&
    (navMatches.length > 0 ||
      homeMatches.length > 0 ||
      utilityMatches.length > 0 ||
      schoolMatches.length > 0);

  if (!panelOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-6 backdrop-blur-[2px] sm:px-6 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-overlay-title"
      onMouseDown={onBackdrop}
    >
      <div
        className="relative mt-[max(0.5rem,env(safe-area-inset-top))] flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="search-overlay-title" className="text-lg font-semibold text-ink">
              Search
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Results update as you type. Escape or the backdrop closes this panel.
            </p>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {loadError ? (
            <p className="text-sm text-red-700">{loadError}</p>
          ) : !bundle ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : !hasQuery ? (
            <section>
              <h3 className="text-sm font-semibold text-ink">Quick links</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {navMatches.map((i: NavItem) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={closePanel}
                      className="font-medium text-accent-dark hover:underline"
                    >
                      {i.label}
                    </Link>
                    <span className="ml-2 text-slate-500">{i.href}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : !hasAnySearchResults ? (
            <p className="text-sm text-ink-muted">No results for that search.</p>
          ) : (
            <div className="space-y-6">
              {navMatches.length > 0 ? (
                <section>
                  <h3 className="text-sm font-semibold text-ink">Pages</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {navMatches.map((i: NavItem) => (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          onClick={closePanel}
                          className="font-medium text-accent-dark hover:underline"
                        >
                          {i.label}
                        </Link>
                        <span className="ml-2 text-slate-500">{i.href}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {homeMatches.length > 0 ? (
                <section>
                  <h3 className="text-sm font-semibold text-ink">Homes</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {homeMatches.map(({ h }) => (
                      <li key={h.id}>
                        <Link
                          href={`/homes/${encodeURIComponent(h.id)}`}
                          onClick={closePanel}
                          className="font-medium text-accent-dark hover:underline"
                        >
                          {formatAddress(h)}
                        </Link>
                        {typeof h.septicField === "number" ? (
                          <span className="ml-2 text-slate-500">Septic #{h.septicField}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {utilityMatches.length > 0 ? (
                <section>
                  <h3 className="text-sm font-semibold text-ink">Utilities</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {utilityMatches.map(({ u }, idx) => (
                      <li key={`${u.category}-${u.providerName ?? ""}-${idx}`}>
                        <span className="font-medium text-ink">{u.category}</span>
                        {u.providerName ? <span className="ml-2 text-ink-muted">{u.providerName}</span> : null}
                        <Link
                          href="/residents"
                          onClick={closePanel}
                          className="ml-3 text-accent-dark hover:underline"
                        >
                          View on Residents
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {schoolMatches.length > 0 ? (
                <section>
                  <h3 className="text-sm font-semibold text-ink">Schools</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {schoolMatches.map(({ s }) => (
                      <li key={s.name}>
                        <Link
                          href="/schools"
                          onClick={closePanel}
                          className="font-medium text-accent-dark hover:underline"
                        >
                          {s.name}
                        </Link>
                        <span className="ml-2 text-slate-500">Grades {s.grades}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
