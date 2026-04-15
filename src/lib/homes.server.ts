import fs from "node:fs";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import type { HomeRecord, HomesFile } from "./homes";

const HOMES_JSON = path.join(process.cwd(), "src", "data", "homes.json");

/** Match `ensureCadFieldsOnHomeRecords` in the CAD import script so UI logic can rely on these keys. */
function withCadFieldDefaults(h: HomeRecord): HomeRecord {
  const out: HomeRecord = { ...h };
  if (!Object.prototype.hasOwnProperty.call(out, "builder")) out.builder = null;
  if (!Object.prototype.hasOwnProperty.call(out, "squareFeet")) out.squareFeet = null;
  if (!Object.prototype.hasOwnProperty.call(out, "solar")) out.solar = null;
  if (!Object.prototype.hasOwnProperty.call(out, "yearBuilt")) out.yearBuilt = null;
  return out;
}

/** Reads `src/data/homes.json` from disk so CAD import script updates show without rebuilding the bundle. */
export function getHomes(): HomesFile {
  noStore();
  const raw = fs.readFileSync(HOMES_JSON, "utf8");
  const data = JSON.parse(raw) as HomesFile;
  data.homes = data.homes.map(withCadFieldDefaults);
  return data;
}

export function getHomeById(id: string): HomeRecord | null {
  return getHomes().homes.find((h) => h.id === id) ?? null;
}
