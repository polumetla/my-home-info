#!/usr/bin/env node
/**
 * Geocode each home in src/data/homes.json via the U.S. Census Geocoder (TIGER) and write latitude/longitude.
 * Re-run after addresses change; use --force to overwrite coords.
 *
 *   npm run geocode:homes
 *   node scripts/geocode-homes.mjs --force
 *   node scripts/geocode-homes.mjs --limit 5
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const homesPath = path.join(__dirname, "..", "src", "data", "homes.json");
const CENSUS_ONE_LINE =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const USER_AGENT = "my-home-info-community-app/1.0 (resident directory; geocode-homes.mjs)";

function formatAddress(h) {
  if (h.street && h.city && h.state && h.zip) {
    return `${h.street}, ${h.city}, ${h.state} ${h.zip}`;
  }
  return h.raw ?? "";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const out = { force: false, limit: Infinity };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--force") out.force = true;
    else if (argv[i] === "--limit" && argv[i + 1]) out.limit = Number.parseInt(argv[++i], 10);
  }
  return out;
}

async function geocodeOne(q) {
  const url = new URL(CENSUS_ONE_LINE);
  url.searchParams.set("address", q);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const m = data?.result?.addressMatches?.[0];
  if (!m?.coordinates) return null;
  const lon = Number(m.coordinates.x);
  const lat = Number(m.coordinates.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

async function main() {
  const { force, limit } = parseArgs(process.argv);
  const raw = JSON.parse(fs.readFileSync(homesPath, "utf8"));
  if (!Array.isArray(raw.homes)) {
    console.error("Invalid homes.json");
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let attempts = 0;

  for (const h of raw.homes) {
    const hasCoords =
      typeof h.latitude === "number" &&
      typeof h.longitude === "number" &&
      Number.isFinite(h.latitude) &&
      Number.isFinite(h.longitude);
    if (hasCoords && !force) {
      skipped++;
      continue;
    }
    if (attempts >= limit) break;

    const q = formatAddress(h);
    if (!q.trim()) {
      failed++;
      continue;
    }

    attempts++;
    await sleep(150);

    try {
      const coords = await geocodeOne(q);
      if (!coords) {
        console.warn(`Not found: ${h.id} — ${q}`);
        failed++;
        continue;
      }
      h.latitude = Math.round(coords.lat * 1e6) / 1e6;
      h.longitude = Math.round(coords.lon * 1e6) / 1e6;
      updated++;
      if (updated % 25 === 0) console.error(`… ${updated} geocoded`);
    } catch (e) {
      console.warn(`Error ${h.id}:`, e.message);
      failed++;
    }
  }

  raw.meta = raw.meta || {};
  raw.meta.geocodedAt = new Date().toISOString();
  fs.writeFileSync(homesPath, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log(`Done. Updated ${updated}, skipped ${skipped}, failed ${failed}. Wrote ${homesPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
