import { getTrashDaySummary, TRASH_TIME_ZONE } from "@/lib/trash-day";

/**
 * Compact trash-day reminder for the landing hero (top-right on wide screens).
 */
export function HomeTrashDayWidget() {
  const { daysUntil, nextDateLabel, isTrashDayToday } = getTrashDaySummary();

  return (
    <aside
      className="w-full max-w-[11.5rem] rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 to-white px-3.5 py-3 shadow-sm ring-1 ring-emerald-100/80"
      aria-label="Trash pickup schedule"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-900">
        Trash day
      </p>
      <p className="mt-0.5 text-[0.65rem] text-slate-500">Every Wednesday · {TRASH_TIME_ZONE.replace("_", " ")}</p>

      <div className="mt-2.5 border-t border-emerald-100/80 pt-2.5">
        {isTrashDayToday ? (
          <p className="text-xl font-bold leading-tight text-ink">Today</p>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tabular-nums leading-none text-ink">{daysUntil}</span>
            <span className="text-xs font-medium text-ink-muted">
              {daysUntil === 1 ? "day" : "days"}
            </span>
          </div>
        )}
        <p className="mt-1 text-[0.7rem] leading-snug text-slate-600">
          {isTrashDayToday ? "Pickup day" : "until Wednesday"}
        </p>
        <p className="mt-1.5 text-[0.65rem] leading-snug text-slate-500">
          {isTrashDayToday ? nextDateLabel : `Next: ${nextDateLabel}`}
        </p>
      </div>
    </aside>
  );
}
