import type { Metadata } from "next";
import { formatOutageLinkLabel, getUtilities } from "@/lib/utilities.server";

export const metadata: Metadata = {
  title: "Residents",
};

const otherSections = [
  {
    title: "Maintenance & vendors",
    items: [
      "HVAC, pool, pest, landscaping — vetted or neighbor-recommended.",
      "Emergency shutoffs: water main, gas, breaker panel (generic checklist).",
    ],
  },
];

function UtilityRow({
  category,
  providerName,
  website,
  outageStatus,
  phone,
  billing,
}: {
  category: string;
  providerName: string | null;
  website: string | null;
  outageStatus: string | null;
  phone: string | null;
  billing: string | null;
}) {
  const hasAny =
    providerName || website || outageStatus || phone || billing;

  return (
    <div className="py-4 first:pt-3 last:pb-3">
      <h3 className="font-semibold text-ink">{category}</h3>
      {providerName ? (
        <p className="mt-1 text-sm text-ink-muted">{providerName}</p>
      ) : !hasAny ? (
        <p className="mt-1 text-sm italic text-slate-500">Details not filled in yet — update SummitInfo.xlsx and run npm run parse:utilities.</p>
      ) : null}

      {hasAny && (
        <ul className="mt-3 space-y-2 text-sm">
          {website ? (
            <li>
              <span className="text-slate-500">Website </span>
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-dark hover:underline"
              >
                {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            </li>
          ) : null}
          {outageStatus ? (
            <li>
              <span className="text-slate-500">{formatOutageLinkLabel(outageStatus)} </span>
              {/^https?:\/\//i.test(outageStatus) ? (
                <a
                  href={outageStatus}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent-dark hover:underline"
                >
                  Open
                </a>
              ) : (
                <span className="text-ink-muted">{outageStatus}</span>
              )}
            </li>
          ) : null}
          {phone ? (
            <li>
              <span className="text-slate-500">Phone </span>
              <a href={`tel:${phone.replace(/\D/g, "")}`} className="font-medium text-accent-dark hover:underline">
                {phone}
              </a>
            </li>
          ) : null}
          {billing ? (
            <li>
              <span className="text-slate-500">Billing / account </span>
              <a
                href={billing}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-dark hover:underline"
              >
                {billing.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

export default function ResidentsPage() {
  const { utilities, meta } = getUtilities();

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Residents</h1>
        <p className="max-w-2xl text-ink-muted">
          Local utilities and provider links for Summit at Lake Travis. Prefer official sites for
          outages, billing, and account changes.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-ink">Utilities &amp; providers</h2>
        {meta.parsedAt ? (
          <p className="mt-1 text-xs text-slate-500">
            Last imported {new Date(meta.parsedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} ·{" "}
            {meta.sourceFile ?? "utilities.json"}
          </p>
        ) : null}

        {utilities.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            No utility rows found. Add{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">src/data/SummitInfo.xlsx</code> and run{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">npm run parse:utilities</code>.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 px-4 sm:px-5">
            {utilities.map((u) => (
              <UtilityRow
                key={`${u.category}-${u.providerName ?? ""}`}
                category={u.category}
                providerName={u.providerName}
                website={u.website}
                outageStatus={u.outageStatus}
                phone={u.phone}
                billing={u.billing}
              />
            ))}
          </div>
        )}
      </section>

      <div className="space-y-8">
        {otherSections.map((section) => (
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
