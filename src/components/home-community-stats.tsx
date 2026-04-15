import Link from "next/link";
import { getHomes } from "@/lib/homes.server";

const R = 52;
const C = 2 * Math.PI * R;
const STROKE = 12;

function DonutGraphic({
  count,
  total,
  label,
  sublabel,
  strokeClass,
  href,
}: {
  count: number;
  total: number;
  label: string;
  sublabel: string;
  strokeClass: string;
  href: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 1000) / 10) : 0;
  const dash = (pct / 100) * C;

  const inner = (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="relative shrink-0" aria-hidden>
        <svg viewBox="0 0 120 120" className="h-36 w-36 sm:h-40 sm:w-40">
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            className="stroke-slate-200"
            strokeWidth={STROKE}
          />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            className={strokeClass}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold tabular-nums text-ink sm:text-3xl">{count}</span>
          <span className="text-xs font-medium text-ink-muted">of {total}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 text-center sm:pt-2 sm:text-left">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1 text-sm text-ink-muted">{sublabel}</p>
        <p className="mt-2 text-lg font-semibold tabular-nums text-ink">{pct}%</p>
        <p className="text-xs text-slate-500">Share of listed homes</p>
      </div>
    </div>
  );

  return (
    <Link
      href={href}
      className="-m-2 block rounded-2xl p-2 outline-none ring-offset-2 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-accent"
    >
      {inner}
    </Link>
  );
}

export function HomeCommunityStats() {
  const { homes } = getHomes();
  const total = homes.length;
  const homesteadYes = homes.filter((h) => h.homestead === "yes").length;
  const solarYes = homes.filter((h) => h.solar === "yes").length;
  const poolYes = homes.filter((h) => h.pool === "yes").length;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Homes snapshot</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Counts from imported CAD fields on the homes list. Totals use all {total} homes in this
            directory.
          </p>
        </div>
        <Link
          href="/homes"
          className="mt-2 text-sm font-medium text-accent-dark hover:underline sm:mt-0"
        >
          View all homes →
        </Link>
      </div>

      {total === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No homes in the directory yet.</p>
      ) : (
        <div className="mt-8 grid gap-10 border-t border-slate-100 pt-8 sm:grid-cols-2 lg:grid-cols-3 sm:gap-12">
          <DonutGraphic
            href="/homes?homestead=yes"
            count={homesteadYes}
            total={total}
            label="Homestead exemption"
            sublabel="Homes flagged with a homestead in county data."
            strokeClass="stroke-accent"
          />
          <DonutGraphic
            href="/homes?solar=yes"
            count={solarYes}
            total={total}
            label="Solar exemption (SO)"
            sublabel="Homes with solar exemption (SO) or SOLAR ARRAY SYSTEM in improvements."
            strokeClass="stroke-amber-500"
          />
          <DonutGraphic
            href="/homes?pool=yes"
            count={poolYes}
            total={total}
            label="Swimming pool"
            sublabel="Homes with a pool noted under improvements."
            strokeClass="stroke-sky-500"
          />
        </div>
      )}
    </section>
  );
}
