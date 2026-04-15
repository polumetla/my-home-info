/** LCRA River Operations Report — Lake Travis (Mansfield Dam). */

const LCRA_RIVER_REPORT_URL = "https://hydromet.lcra.org/api/RiverReport/GetRiverReportData/";

/** Top of conservation pool elevation for Lake Travis (ft msl), per LCRA River Report copy. */
export const LAKE_TRAVIS_CONSERVATION_POOL_FT = 681;

const USER_AGENT = "my-home-info-community-app/1.0 (resident directory; contact via site owner)";

type LcraLakeLevelRow = {
  lake_dam?: string;
  site_number?: number;
  date_time?: string;
  head_Elevation?: number;
  wkElev?: number;
  monthElev?: number;
};

type LcraStorageRow = {
  reservoir_name?: string;
  site_number?: number;
  date_time?: string;
  data_valid?: number;
  average?: number;
  difffromAvg?: number;
  capacity?: number;
  currentVol?: number;
  percentFull?: number;
  differencefromfull?: number;
};

type LcraRiverReportResponse = {
  lastUpdate?: string;
  currentLakeLevels?: LcraLakeLevelRow[];
  currentStorage?: LcraStorageRow[];
};

export type LakeTravisPayload = {
  /** When LCRA last refreshed the report page data (ISO). */
  reportLastUpdate: string;
  /** Lake level row timestamp (ISO). */
  levelAsOf: string;
  lakeDamLabel: string;
  /** Current lake surface elevation (ft msl). */
  levelFtMsl: number;
  /** Approximate level 7 days ago (ft msl). */
  weekAgoFtMsl: number;
  /** Approximate level 30 days ago (ft msl). */
  monthAgoFtMsl: number;
  /** Combined Buchanan + Travis storage row for Travis — fraction 0–1. */
  percentFull: number;
  currentVolAcFt: number;
  capacityAcFt: number;
  /** Historical average lake level for this date (ft msl), per LCRA. */
  historicalAvgFtMsl: number;
  diffFromHistoricalAvgFt: number;
};

function findTravisLakeLevel(rows: LcraLakeLevelRow[] | undefined): LcraLakeLevelRow | undefined {
  if (!rows?.length) return undefined;
  return (
    rows.find((r) => r.site_number === 3963) ??
    rows.find((r) => /travis/i.test(String(r.lake_dam ?? "")))
  );
}

function findTravisStorage(rows: LcraStorageRow[] | undefined): LcraStorageRow | undefined {
  if (!rows?.length) return undefined;
  return (
    rows.find((r) => r.site_number === 3963) ??
    rows.find((r) => String(r.reservoir_name ?? "").toLowerCase() === "travis")
  );
}

export async function getLakeTravisFromLcraRiverReport(): Promise<LakeTravisPayload | null> {
  let json: LcraRiverReportResponse;
  try {
    const res = await fetch(LCRA_RIVER_REPORT_URL, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    json = (await res.json()) as LcraRiverReportResponse;
  } catch {
    return null;
  }

  const level = findTravisLakeLevel(json.currentLakeLevels);
  const storage = findTravisStorage(json.currentStorage);

  if (
    !level ||
    level.head_Elevation == null ||
    level.wkElev == null ||
    level.monthElev == null ||
    !level.date_time
  ) {
    return null;
  }

  const pctRaw = storage?.percentFull;
  const percentFull =
    typeof pctRaw === "number" && Number.isFinite(pctRaw) ? Math.min(1, Math.max(0, pctRaw)) : 0;

  const cap = storage?.capacity;
  const vol = storage?.currentVol;
  const capacityAcFt = typeof cap === "number" && Number.isFinite(cap) ? cap : 0;
  const currentVolAcFt = typeof vol === "number" && Number.isFinite(vol) ? vol : 0;

  const avg = storage?.average;
  const diffAvg = storage?.difffromAvg;
  const historicalAvgFtMsl = typeof avg === "number" && Number.isFinite(avg) ? avg : level.head_Elevation;
  const diffFromHistoricalAvgFt =
    typeof diffAvg === "number" && Number.isFinite(diffAvg) ? diffAvg : 0;

  return {
    reportLastUpdate: json.lastUpdate ?? new Date().toISOString(),
    levelAsOf: level.date_time,
    lakeDamLabel: String(level.lake_dam ?? "Lake Travis"),
    levelFtMsl: level.head_Elevation,
    weekAgoFtMsl: level.wkElev,
    monthAgoFtMsl: level.monthElev,
    percentFull,
    currentVolAcFt,
    capacityAcFt,
    historicalAvgFtMsl,
    diffFromHistoricalAvgFt,
  };
}
