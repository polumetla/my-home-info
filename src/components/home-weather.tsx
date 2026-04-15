import { getWeatherForHomeArea } from "@/lib/weather.server";

export async function HomeWeather() {
  const w = await getWeatherForHomeArea();

  if (!w) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-ink">Local weather</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Weather data is temporarily unavailable. Try again in a few minutes.
        </p>
      </section>
    );
  }

  const { current, daily, locationLabel, asOf } = w;
  const weekHigh = Math.max(...daily.map((d) => d.highF));
  const weekLow = Math.min(...daily.map((d) => d.lowF));
  const span = Math.max(1, weekHigh - weekLow);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Local weather</h2>
          <p className="mt-1 text-sm text-ink-muted">{locationLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Current conditions as of {asOf} · America/Chicago
          </p>
        </div>
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-accent-dark hover:underline"
        >
          Data: Open-Meteo
        </a>
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-stretch">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-sky-50 to-white px-6 py-8 text-center sm:flex-row sm:gap-8 sm:text-left">
          <span className="text-7xl leading-none" aria-hidden>
            {current.emoji}
          </span>
          <div>
            <p className="text-5xl font-semibold tabular-nums text-ink">{current.tempF}°</p>
            <p className="mt-1 text-sm text-ink-muted">
              Feels like {current.apparentF}° · {current.label}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Humidity {current.humidity}% · Wind {current.windMph} mph {current.windDir}
            </p>
          </div>
        </div>

        <div className="flex-1">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            7-day outlook
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:justify-between">
            {daily.map((d) => {
              const topPct = ((weekHigh - d.highF) / span) * 100;
              const heightPct = Math.max(((d.highF - d.lowF) / span) * 100, 6);

              return (
                <div
                  key={d.date}
                  className="flex min-w-[4.25rem] flex-1 flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-3"
                >
                  <span className="text-[0.65rem] font-semibold uppercase text-slate-500">
                    {d.weekday}
                  </span>
                  <span className="text-xl" title={d.label} aria-hidden>
                    {d.emoji}
                  </span>
                  <div
                    className="relative h-24 w-full max-w-[3rem] rounded-full bg-slate-200/80"
                    role="img"
                    aria-label={`${d.weekday} low ${d.lowF} high ${d.highF} degrees`}
                  >
                    <div
                      className="absolute left-1/2 w-3 -translate-x-1/2 rounded-full bg-gradient-to-b from-sky-400 to-indigo-500"
                      style={{
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                        minHeight: "0.375rem",
                      }}
                    />
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-ink">{d.highF}°</p>
                  <p className="text-xs tabular-nums text-slate-500">{d.lowF}°</p>
                  {d.precipProb != null && d.precipProb > 0 && (
                    <p className="text-[0.65rem] text-sky-700">{d.precipProb}% rain</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Bars show each day&apos;s temperature range against this week&apos;s lows and highs.
          </p>
        </div>
      </div>
    </section>
  );
}
