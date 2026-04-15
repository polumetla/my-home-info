export type HomeRecord = {
  id: string;
  /** Street line only, e.g. "2406 SKYWALK LN" */
  street: string;
  /** Septic field / system # from the community map PDF */
  septicField?: number;
  /** Optional info you can fill in over time */
  builder?: string | null;
  model?: string;
  /** From CAD improvement detail row `HVAC RESIDENTIAL` → `actualYearBuilt`. */
  yearBuilt?: number | null;
  /** Living area (sq ft) from Travis CAD improvement `livingArea`. */
  squareFeet?: number | null;
  /**
   * Public-record property appraisal history (e.g., from county CAD).
   * Values are in USD (whole dollars).
   */
  appraisalHistory?: Array<{
    year: number;
    appraisedValue: number;
  }>;
  /**
   * Travis County Prodigy CAD property id (from the URL path), e.g.
   * `https://travis.prodigycad.com/property-detail/946979/`
   */
  cadPropertyId?: string;
  homestead?: "yes" | "no";
  /** Travis solar: CAD `exemptionList` code SO and/or improvement `imprvSpecificDescription` solar array. */
  solar?: "yes" | "no" | null;
  pool?: "yes" | "no";
  city: string;
  state: string;
  zip: string;
  raw: string;
  unparsed?: boolean;
};

export type HomesFile = {
  meta: {
    source: string | null;
    generatedAt: string | null;
    count: number;
    mailingCity?: string;
    mailingState?: string;
    mailingZip?: string;
    note?: string;
    appraisalImportAt?: string;
  };
  homes: HomeRecord[];
};

export function formatAddress(h: HomeRecord): string {
  if (h.street && h.city && h.state && h.zip) {
    return `${h.street}, ${h.city}, ${h.state} ${h.zip}`;
  }
  return h.raw;
}

export function getAppraisalForYear(h: HomeRecord, year: number): number | null {
  const hit = h.appraisalHistory?.find((x) => x.year === year);
  return typeof hit?.appraisedValue === "number" ? hit.appraisedValue : null;
}

export function getLatestAppraisal(h: HomeRecord): { year: number; value: number } | null {
  const hist = h.appraisalHistory;
  if (!hist || hist.length === 0) return null;
  const sorted = [...hist].sort((a, b) => b.year - a.year);
  const top = sorted[0]!;
  return { year: top.year, value: top.appraisedValue };
}

export function formatUsd(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** CAD living area for tables and labels. */
export function formatLivingAreaSqft(h: HomeRecord): string {
  const n = h.squareFeet;
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString()} sq ft`;
}

/** Travis CAD public portal property page (Prodigy). */
export function getTravisCadPropertyUrl(cadPropertyId: string): string {
  const id = cadPropertyId.trim();
  return `https://travis.prodigycad.com/property-detail/${id}/`;
}

/**
 * Year-over-year % change using the two most recent appraisal years in history.
 * Positive = increase vs prior year.
 */
export function getYoYChangePercent(h: HomeRecord): number | null {
  const hist = h.appraisalHistory;
  if (!hist || hist.length < 2) return null;
  const sorted = [...hist].sort((a, b) => b.year - a.year);
  const cur = sorted[0]!;
  const prev = sorted[1]!;
  if (prev.appraisedValue <= 0) return null;
  return ((cur.appraisedValue - prev.appraisedValue) / prev.appraisedValue) * 100;
}

export function formatPercentChange(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

/** Case-insensitive search: every whitespace-separated term must match somewhere in address or septic #. */
export function filterHomesByQuery(homes: HomeRecord[], query: string): HomeRecord[] {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return homes;
  return homes.filter((h) => {
    const latest = getLatestAppraisal(h);
    const yoy = getYoYChangePercent(h);
    const hay = [
      formatAddress(h),
      h.street ?? "",
      h.septicField != null ? String(h.septicField) : "",
      h.builder ?? "",
      h.model ?? "",
      h.yearBuilt != null ? String(h.yearBuilt) : "",
      h.cadPropertyId ?? "",
      h.homestead ?? "",
      h.solar ?? "",
      h.pool ?? "",
      h.squareFeet != null ? String(h.squareFeet) : "",
      latest ? String(latest.value) : "",
      latest ? String(latest.year) : "",
      yoy != null ? formatPercentChange(yoy) : "",
    ]
      .join(" ")
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function uniqNonEmpty(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
