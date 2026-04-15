import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnwellReferralLink } from "@/components/ownwell-referral-link";
import {
  formatAddress,
  formatLivingAreaSqft,
  formatPercentChange,
  formatUsd,
  getLatestAppraisal,
  getTravisCadPropertyUrl,
  getYoYChangePercent,
} from "@/lib/homes";
import { getHomeById } from "@/lib/homes.server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function formatYesNoCad(value: "yes" | "no" | undefined | null): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "—";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const h = getHomeById(id);
  if (!h) return { title: "Home" };
  return { title: h.street };
}

export default async function HomeDetailPage({ params }: Props) {
  const { id } = await params;
  const h = getHomeById(id);
  if (!h) notFound();

  const latest = getLatestAppraisal(h);
  const yoy = getYoYChangePercent(h);
  const hist = [...(h.appraisalHistory ?? [])].sort((a, b) => b.year - a.year);

  return (
    <div className="space-y-8">
      <nav className="text-sm text-ink-muted">
        <Link href="/homes" className="font-medium text-accent-dark hover:underline">
          Homes
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-ink">{h.street}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{h.street}</h1>
        <p className="text-lg text-ink-muted">
          {h.city}, {h.state} {h.zip}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">Property</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Full address</dt>
            <dd className="mt-1 text-ink">{formatAddress(h)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Septic field</dt>
            <dd className="mt-1 text-ink">
              {typeof h.septicField === "number" ? `#${h.septicField}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Builder</dt>
            <dd className="mt-1 text-ink">{h.builder?.trim() ? h.builder : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Model</dt>
            <dd className="mt-1 text-ink">{h.model?.trim() ? h.model : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Year built</dt>
            <dd className="mt-1 text-ink">{typeof h.yearBuilt === "number" ? h.yearBuilt : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Living area (CAD)</dt>
            <dd className="mt-1 text-ink">{formatLivingAreaSqft(h)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Homestead (HS)</dt>
            <dd className="mt-1 text-ink">{formatYesNoCad(h.homestead)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Solar (SO)</dt>
            <dd className="mt-1 text-ink">{formatYesNoCad(h.solar)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Pool</dt>
            <dd className="mt-1 text-ink">{formatYesNoCad(h.pool)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Travis CAD</dt>
            <dd className="mt-1 text-ink">
              {h.cadPropertyId?.trim() ? (
                <a
                  href={getTravisCadPropertyUrl(h.cadPropertyId.trim())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent-dark underline decoration-slate-200 underline-offset-2 hover:decoration-accent-dark"
                >
                  View property record
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest appraisal</dt>
            <dd className="mt-1 text-ink">
              {latest ? (
                <span>
                  {formatUsd(latest.value)} <span className="text-ink-muted">({latest.year})</span>
                </span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">YoY (latest)</dt>
            <dd className="mt-1 text-ink">
              {yoy != null ? (
                <span
                  className={
                    yoy > 0 ? "text-emerald-800" : yoy < 0 ? "text-rose-800" : "text-ink-muted"
                  }
                >
                  {formatPercentChange(yoy)}
                </span>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">Appraisal history</h2>
        {hist.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No appraisal history imported yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-2 pr-4 font-semibold text-ink">Year</th>
                  <th className="pb-2 font-semibold text-ink">Appraised value</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((row) => (
                  <tr key={row.year} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-4 tabular-nums text-ink-muted">{row.year}</td>
                    <td className="py-2 font-medium text-ink">{formatUsd(row.appraisedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">Property taxes</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Official resources for paying and understanding your bill. Always confirm deadlines, amounts, and
          requirements on the linked sites.
        </p>
        <ul className="mt-4 list-none space-y-3 text-sm">
          <li>
            <a
              href="https://tax-office.traviscountytx.gov/properties/taxes/payment-methods/online"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-dark underline decoration-slate-200 underline-offset-2 hover:decoration-accent-dark"
            >
              Pay property taxes online
            </a>
            <span className="mt-0.5 block text-xs text-ink-muted">Travis County Tax Office — eCheck, card, PayPal, etc.</span>
          </li>
          <li>
            <a
              href="https://traviscad.org/protests/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-dark underline decoration-slate-200 underline-offset-2 hover:decoration-accent-dark"
            >
              Protest process (TCAD)
            </a>
            <span className="mt-0.5 block text-xs text-ink-muted">
              How to file a value protest, informal meetings, and ARB hearings.
            </span>
          </li>
          <li>
            <OwnwellReferralLink className="font-medium text-accent-dark underline decoration-slate-200 underline-offset-2 hover:decoration-accent-dark" />
            <span className="mt-0.5 block text-xs text-ink-muted">
              Third-party appeals service — referral link; see disclosure below.
            </span>
          </li>
        </ul>
        <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-xs leading-relaxed text-ink-muted">
          <p>
            <span className="font-semibold text-ink">Accuracy.</span> This site does not replace your tax bill or
            county records. Verify that payment windows, protest deadlines, fees, and account details are still
            current before you act.
          </p>
          <p>
            <span className="font-semibold text-ink">Affiliate.</span> The Ownwell link is a{" "}
            <span className="text-ink">business affiliate / referral</span> link. The site may receive
            compensation if you use it. That relationship does not change official Travis County or TCAD
            processes; use government links above for authoritative rules.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/homes/map"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-slate-300"
        >
          View on map
        </Link>
        <Link
          href="/homes"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-slate-300"
        >
          All homes
        </Link>
      </div>
    </div>
  );
}
