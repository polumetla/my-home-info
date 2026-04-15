import {
  getLakeTravisFromLcraRiverReport,
  LAKE_TRAVIS_CONSERVATION_POOL_FT,
} from "@/lib/lcra-river.server";

const LCRA_RIVER_REPORT_PAGE = "https://hydromet.lcra.org/riverreport/";

function formatCentral(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  }).format(d);
}

function fmtFt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function HomeLakeTravis() {
  const data = await getLakeTravisFromLcraRiverReport();

  if (!data) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-ink">Lake Travis</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Lake level data from LCRA is temporarily unavailable. Try again in a few minutes.
        </p>
      </section>
    );
  }

  const {
    reportLastUpdate,
    levelAsOf,
    lakeDamLabel,
    levelFtMsl,
    weekAgoFtMsl,
    monthAgoFtMsl,
    percentFull,
    currentVolAcFt,
    capacityAcFt,
    historicalAvgFtMsl,
    diffFromHistoricalAvgFt,
  } = data;

  const pctDisplay = Math.round(percentFull * 1000) / 10;
  const conservation = LAKE_TRAVIS_CONSERVATION_POOL_FT;
  const vsPool = levelFtMsl - conservation;

  const levels = [
    { label: "Now", value: levelFtMsl, emphasis: true },
    { label: "7 days ago", value: weekAgoFtMsl, emphasis: false },
    { label: "30 days ago", value: monthAgoFtMsl, emphasis: false },
  ];
  const minL = Math.min(...levels.map((l) => l.value));
  const maxL = Math.max(...levels.map((l) => l.value));
  const pad = Math.max(0.5, (maxL - minL) * 0.08 || 0.25);
  const chartMin = minL - pad;
  const chartMax = maxL + pad;
  const span = Math.max(chartMax - chartMin, 0.01);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Lake Travis water level</h2>
          <p className="mt-1 text-sm text-ink-muted">{lakeDamLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Level as of {formatCentral(levelAsOf)} · Report updated {formatCentral(reportLastUpdate)}
          </p>
        </div>
        <a
          href={LCRA_RIVER_REPORT_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-accent-dark hover:underline"
        >
          Data: LCRA River Operations Report
        </a>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-stretch">
        <div className="flex flex-col justify-center gap-4 rounded-2xl bg-gradient-to-b from-cyan-50/90 to-white px-6 py-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Current lake level
            </p>
            <p className="mt-1 text-5xl font-semibold tabular-nums text-ink">{fmtFt(levelFtMsl)}</p>
            <p className="mt-1 text-sm text-ink-muted">ft msl (mean sea level)</p>
          </div>
          <p className="text-sm text-ink-muted">
            Conservation pool top is {conservation} ft msl —{" "}
            <span className="font-medium text-ink">
              {vsPool >= 0 ? `${fmtFt(vsPool)} ft above` : `${fmtFt(Math.abs(vsPool))} ft below`}{" "}
              pool
            </span>
            .
          </p>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              vs historical average (this date)
            </p>
            <p className="mt-1 text-sm text-ink">
              {fmtFt(historicalAvgFtMsl)} ft avg ·{" "}
              <span className="font-semibold tabular-nums">
                {diffFromHistoricalAvgFt >= 0 ? "+" : ""}
                {fmtFt(diffFromHistoricalAvgFt)} ft
              </span>{" "}
              from average
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Travis reservoir storage
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div
                className="relative h-4 flex-1 overflow-hidden rounded-full bg-slate-200/90"
                role="img"
                aria-label={`Lake Travis is about ${pctDisplay} percent full`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-600"
                  style={{ width: `${Math.min(100, Math.max(0, pctDisplay))}%` }}
                />
              </div>
              <span className="text-lg font-semibold tabular-nums text-ink">{pctDisplay}%</span>
            </div>
            {capacityAcFt > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                {Math.round(currentVolAcFt).toLocaleString("en-US")} of{" "}
                {Math.round(capacityAcFt).toLocaleString("en-US")} acre-feet (Travis)
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Level vs recent past (ft msl)
            </p>
            <div className="mt-3 flex h-48 items-end justify-between gap-2 sm:gap-4">
              {levels.map((row) => {
                const fillPct = ((row.value - chartMin) / span) * 100;
                const heightPct = Math.max(fillPct, 4);

                return (
                  <div
                    key={row.label}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-sm font-semibold tabular-nums text-ink">
                      {fmtFt(row.value)}
                    </span>
                    <div
                      className="relative h-32 w-full max-w-[4rem] rounded-t-lg bg-slate-200/80"
                      role="img"
                      aria-label={`${row.label}: ${fmtFt(row.value)} feet msl`}
                    >
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-t-lg ${
                          row.emphasis
                            ? "bg-gradient-to-t from-cyan-600 to-sky-400"
                            : "bg-gradient-to-t from-slate-500 to-slate-400"
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-center text-[0.65rem] font-semibold uppercase text-slate-500">
                      {row.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Bar heights compare the three reported elevations on a common scale (min–max of the
              three, with padding).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
