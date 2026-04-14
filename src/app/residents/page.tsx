import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Residents",
};

const placeholderSections = [
  {
    title: "Utilities",
    items: [
      "Electric — add your TDU / provider link and outage map.",
      "Water / wastewater — district or MUD contact and payment portal.",
      "Gas — if applicable, marketer vs pipeline basics.",
      "Trash & recycling — schedule and bulk pickup rules.",
    ],
  },
  {
    title: "Maintenance & vendors",
    items: [
      "HVAC, pool, pest, landscaping — vetted or neighbor-recommended.",
      "Emergency shutoffs: water main, gas, breaker panel (generic checklist).",
    ],
  },
  {
    title: "Community",
    items: [
      "HOA / management contact (if public or shared with consent).",
      "Architectural guidelines link (if applicable).",
    ],
  },
];

export default function ResidentsPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Residents</h1>
        <p className="max-w-2xl text-ink-muted">
          Replace placeholders with your community&apos;s real links and numbers. Prefer linking to
          official provider sites over copying rate tables.
        </p>
      </header>

      <div className="space-y-8">
        {placeholderSections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-ink-muted">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
