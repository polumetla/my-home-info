import fs from "node:fs";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";

const UTILITIES_JSON = path.join(process.cwd(), "src", "data", "utilities.json");

export type UtilityEntry = {
  category: string;
  providerName: string | null;
  website: string | null;
  outageStatus: string | null;
  phone: string | null;
  billing: string | null;
};

export type UtilitiesFile = {
  meta: {
    sourceFile?: string;
    parsedAt?: string;
    sheet?: string;
    headerRow?: string[];
  };
  utilities: UtilityEntry[];
};

/** Reads `src/data/utilities.json` (from `npm run parse:utilities`). */
export function getUtilities(): UtilitiesFile {
  noStore();
  try {
    const raw = fs.readFileSync(UTILITIES_JSON, "utf8");
    const data = JSON.parse(raw) as UtilitiesFile;
    if (!Array.isArray(data.utilities)) data.utilities = [];
    return data;
  } catch {
    return { meta: {}, utilities: [] };
  }
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/** Display string for outage/status cell (URL → short label). */
export function formatOutageLinkLabel(value: string): string {
  const v = value.trim();
  if (isHttpUrl(v)) {
    try {
      const host = new URL(v).hostname.replace(/^www\./, "");
      return host ? `Outage / status (${host})` : "Outage / status";
    } catch {
      return "Outage / status";
    }
  }
  return v;
}
