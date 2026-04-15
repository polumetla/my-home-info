import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Property context",
};

export default function PropertyPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Property context</h1>
        <p className="max-w-2xl text-ink-muted">
          Link to authoritative public sources (county appraisal district, tax office, flood maps,
          deed search). Avoid scraping or republishing full datasets unless their terms allow it.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">Starter checklist</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-ink-muted">
          <li>County appraisal / property search URL</li>
          <li>Tax jurisdiction explanation (county vs city vs special districts)</li>
          <li>FEMA flood map or local floodplain portal (if relevant)</li>
          <li>Deed / plat lookup for your county</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-surface-muted/50 p-6 text-sm text-ink-muted">
        <strong className="font-medium text-ink">Claim my home (coming soon):</strong> verified
        owners could attach private notes—appliance serials, warranty PDFs, paint codes—stored
        securely behind login.
      </section>
    </div>
  );
}
