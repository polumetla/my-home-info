/** Trash pickup day for the neighborhood — every Wednesday (America/Chicago). */

export const TRASH_TIME_ZONE = "America/Chicago";

const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function weekdayIndexChicago(date: Date): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: TRASH_TIME_ZONE,
    weekday: "short",
  }).format(date);
  return WEEKDAY_SHORT_TO_INDEX[short] ?? 0;
}

function getChicagoYmd(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TRASH_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, d };
}

function addCalendarDays(y: number, m: number, d: number, add: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + add));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** 0 = today is trash day; otherwise calendar days until the next Wednesday in Chicago. */
export function daysUntilNextTrashWednesday(now: Date = new Date()): number {
  const wd = weekdayIndexChicago(now);
  if (wd === 3) return 0;
  return (3 - wd + 7) % 7;
}

/** Next trash Wednesday as a Date at ~noon UTC so weekday checks match the intended calendar day in Texas. */
export function getNextTrashWednesdayDate(now: Date = new Date()): Date {
  const { y, m, d } = getChicagoYmd(now);
  const wd = weekdayIndexChicago(now);
  const add = wd === 3 ? 0 : (3 - wd + 7) % 7;
  const next = addCalendarDays(y, m, d, add);
  return new Date(Date.UTC(next.y, next.m - 1, next.d, 17, 0, 0));
}

export type TrashDaySummary = {
  daysUntil: number;
  nextDateLabel: string;
  isTrashDayToday: boolean;
};

export function getTrashDaySummary(now: Date = new Date()): TrashDaySummary {
  const daysUntil = daysUntilNextTrashWednesday(now);
  const next = getNextTrashWednesdayDate(now);
  const nextDateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: TRASH_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(next);

  return {
    daysUntil,
    nextDateLabel,
    isTrashDayToday: daysUntil === 0,
  };
}
