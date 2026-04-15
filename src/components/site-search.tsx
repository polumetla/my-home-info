"use client";

import { useSiteSearch } from "@/components/site-search-provider";

export function SiteSearch({ className }: { className?: string }) {
  const { q, setQ, flushSearch } = useSiteSearch();

  return (
    <form
      className={className}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        flushSearch();
      }}
    >
      <label className="sr-only" htmlFor="site-search">
        Search
      </label>
      <input
        id="site-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search…"
        className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-ink placeholder:text-slate-400 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        autoComplete="off"
      />
    </form>
  );
}

