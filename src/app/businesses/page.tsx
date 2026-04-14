import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Local businesses",
};

export default function BusinessesPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Local businesses</h1>
        <p className="max-w-2xl text-ink-muted">
          Future: categories (home services, food, medical), optional sponsored slots, and
          affiliate links where appropriate. Start with a short curated list you personally trust.
        </p>
      </header>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-surface-muted/50 p-8 text-center text-sm text-ink-muted">
        No listings yet—add your first category and a few vetted businesses from the codebase or a
        CMS once you wire one in.
      </section>
    </div>
  );
}
