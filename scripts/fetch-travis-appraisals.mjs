#!/usr/bin/env node
/**
 * Travis County CAD (Prodigy) — import appraised values + history into src/data/homes.json
 *
 * Value history in Prodigy often uses **pYear** + **ownerAppraisedValue** (see portal charts),
 * not `year` + `appraisedValue`. This script captures JSON from trueprodigyapi.com in a real
 * browser session and extracts those fields.
 *
 * **Builder:** from sale/transfer JSON, uses the **buyer** on the row with the oldest
 * **appraisal date** when present; otherwise oldest sale/deed date or year.
 *
 * Prerequisite:
 *   npm install
 *   npx playwright install chromium
 *
 * Usage:
 *   # Resolve missing CAD ids from property search, then import appraisals for ALL homes (default)
 *   node scripts/fetch-travis-appraisals.mjs
 *
 *   node scripts/fetch-travis-appraisals.mjs --limit=5
 *   node scripts/fetch-travis-appraisals.mjs --dry-run
 *   node scripts/fetch-travis-appraisals.mjs --no-resolve       (skip search; only homes with cadPropertyId)
 *   node scripts/fetch-travis-appraisals.mjs --appraisals-only   (same as --no-resolve)
 *   node scripts/fetch-travis-appraisals.mjs --resolve-limit=10  (cap how many addresses get CAD id lookup)
 *   node scripts/fetch-travis-appraisals.mjs --limit=5           (cap appraisal imports after ids are known)
 *   node scripts/fetch-travis-appraisals.mjs --debug             (write debug JSON/HTML on failures; builder trace)
 *
 * Optional merge file (gitignored): data/cad-property-ids.json
 * Shape: { "<home id>": "<cad property id>" }
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const homesPath = path.join(root, "src", "data", "homes.json");
const mergePath = path.join(root, "data", "cad-property-ids.json");
const debugPath = path.join(root, "data", "last-appraisal-debug.json");
const resolveSearchJsonPath = path.join(root, "data", "last-resolve-search.json");
const resolveDebugHtmlPath = path.join(root, "data", "last-resolve-debug.html");

const DELAY_APPRAISAL_MS = 3500;
const DELAY_RESOLVE_MS = 2500;
const PAGE_WAIT_MS = 15000;

function parseArgs() {
  const args = process.argv.slice(2);
  let appraisalLimit = Infinity;
  let resolveLimit = Infinity;
  let dryRun = false;
  let resolveIds = true;
  let appraisalsOnly = false;
  let debug = false;
  let headed = false;
  for (const a of args) {
    if (a === "--dry-run") dryRun = true;
    if (a === "--no-resolve") resolveIds = false;
    if (a === "--appraisals-only") {
      appraisalsOnly = true;
      resolveIds = false;
    }
    if (a === "--debug") debug = true;
    if (a === "--headed") headed = true;
    let m = /^--limit=(\d+)$/.exec(a);
    if (m) appraisalLimit = Number.parseInt(m[1], 10);
    m = /^--resolve-limit=(\d+)$/.exec(a);
    if (m) resolveLimit = Number.parseInt(m[1], 10);
  }
  return { appraisalLimit, resolveLimit, dryRun, resolveIds, appraisalsOnly, debug, headed };
}

function isYear(n) {
  return Number.isInteger(n) && n >= 1990 && n <= 2100;
}

function pickYear(o) {
  const c =
    o.pYear ??
    o.year ??
    o.taxYear ??
    o.rollYear ??
    o.valuationYear ??
    o.appraisalYear ??
    o.yearOfAppraisal;
  if (typeof c === "number" && isYear(c)) return c;
  if (typeof c === "string" && /^\d{4}$/.test(c)) return Number.parseInt(c, 10);
  return null;
}

function pickValue(o) {
  const keys = [
    "ownerAppraisedValue",
    "totalAppraisedValue",
    "appraisedValue",
    "totalMarketValue",
    "marketValue",
    "assessedValue",
    "totalValue",
    "appraisalValue",
  ];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && v >= 1000 && v < 1e10) return Math.round(v);
  }
  return null;
}

/** Collect { year, appraisedValue } from Prodigy JSON (generic walk). */
function extractRows(obj, out) {
  if (obj == null) return;
  if (Array.isArray(obj)) {
    for (const x of obj) extractRows(x, out);
    return;
  }
  if (typeof obj !== "object") return;

  const y = pickYear(obj);
  const v = pickValue(obj);
  if (y != null && v != null) {
    out.push({ year: y, appraisedValue: v });
  }

  for (const k of Object.keys(obj)) {
    if (k === "geometry" || k === "features") continue;
    extractRows(obj[k], out);
  }
}

/** Fast path: Travis value history arrays use pYear + ownerAppraisedValue. */
function extractProdigyValueHistory(obj, out) {
  if (obj == null) return;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      if (x && typeof x === "object" && typeof x.pYear === "number" && typeof x.ownerAppraisedValue === "number") {
        if (isYear(x.pYear) && x.ownerAppraisedValue >= 1000) {
          out.push({ year: x.pYear, appraisedValue: Math.round(x.ownerAppraisedValue) });
        }
      } else {
        extractProdigyValueHistory(x, out);
      }
    }
    return;
  }
  if (typeof obj !== "object") return;
  for (const k of Object.keys(obj)) extractProdigyValueHistory(obj[k], out);
}

function mergeByYear(rows) {
  const map = new Map();
  for (const r of rows) {
    const prev = map.get(r.year);
    if (!prev || r.appraisedValue > prev) map.set(r.year, r.appraisedValue);
  }
  return [...map.entries()]
    .map(([year, appraisedValue]) => ({ year, appraisedValue }))
    .sort((a, b) => a.year - b.year);
}

/** Parse common CAD date strings / timestamps for sorting (oldest first). */
function parseDateToMs(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    if (value > 1e12) return value;
    if (value > 1e9 && value < 1e12) return value * 1000;
    if (isYear(value)) return Date.UTC(value, 0, 1);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    const iso = Date.parse(s);
    if (!Number.isNaN(iso)) return iso;
    const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (mdy) return Date.UTC(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (ymd) return Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }
  return null;
}

function pickBuyerName(o) {
  const keys = [
    "buyer",
    "buyerName",
    "buyer_name",
    "Buyer",
    "grantee",
    "granteeName",
    "grantee_name",
  ];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length >= 2 && !/^n\/a$/i.test(t) && !/^unknown$/i.test(t)) return t;
    }
  }
  return null;
}

/**
 * Sort key for a sale/transfer row: prefer **appraisal date**, then sale/deed, then year fields.
 * `kind` is used to prefer rows that actually have an appraisal date when picking "oldest appraisal".
 */
function pickSortTimeForBuyerRecord(o) {
  const apKeys = ["appraisalDate", "appraisal_date", "appraisalDt", "appraisal_dt"];
  for (const k of apKeys) {
    const ms = parseDateToMs(o[k]);
    if (ms != null) return { ms, kind: "appraisal" };
  }
  const sKeys = ["saleDate", "sale_date", "deedDate", "deed_date", "effectiveDate", "recordDate"];
  for (const k of sKeys) {
    const ms = parseDateToMs(o[k]);
    if (ms != null) return { ms, kind: "sale" };
  }
  const y = o.appraisalYear ?? o.saleYear ?? o.deedYear ?? o.taxYear;
  if (typeof y === "number" && isYear(y)) return { ms: Date.UTC(y, 5, 15), kind: "year" };
  return null;
}

function gatherBuyerRecords(obj, out, depth) {
  if (depth > 26 || obj == null) return;
  if (Array.isArray(obj)) {
    for (const x of obj) gatherBuyerRecords(x, out, depth + 1);
    return;
  }
  if (typeof obj !== "object") return;

  const buyer = pickBuyerName(obj);
  const st = pickSortTimeForBuyerRecord(obj);
  if (buyer && st) {
    out.push({ buyer, ...st });
  }
  for (const k of Object.keys(obj)) {
    if (k === "geometry" || k === "features") continue;
    gatherBuyerRecords(obj[k], out, depth + 1);
  }
}

/** Buyer name on the oldest appraisal-dated row when available; else oldest sale/year. */
function extractBuilderFromPayloads(payloads) {
  const recs = [];
  for (const p of payloads) {
    gatherBuyerRecords(p, recs, 0);
  }
  if (recs.length === 0) return null;
  const withAppraisal = recs.filter((r) => r.kind === "appraisal");
  const pool = withAppraisal.length > 0 ? withAppraisal : recs;
  pool.sort((a, b) => a.ms - b.ms);
  return pool[0].buyer;
}

function loadIdMerge() {
  if (!fs.existsSync(mergePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(mergePath, "utf8"));
  } catch {
    return {};
  }
}

function attachJsonListener(page, payloads) {
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("trueprodigyapi.com")) return;
    try {
      const text = await response.text();
      if (!text || text.length > 2_000_000) return;
      const t = text.trim();
      if (t[0] !== "{" && t[0] !== "[") return;
      const json = JSON.parse(t);
      payloads.push(json);
    } catch {
      /* not JSON */
    }
  });
}

function formatAddressLine(h) {
  return `${h.street}, ${h.city}, ${h.state} ${h.zip}`.replace(/\s+/g, " ").trim();
}

/**
 * Travis CAD quick search often fails when the full street suffix is included; matching works
 * with the last token omitted (e.g. "19300 SUMMIT GLORY" instead of "... GLORY TRL").
 */
function streetWithoutLastWord(street) {
  const parts = String(street ?? "")
    .trim()
    .split(/\s+/);
  if (parts.length < 2) return null;
  return parts.slice(0, -1).join(" ");
}

/** Search query variants (street-only; city/state/zip do NOT help this portal). */
function formatSearchQueryVariants(h) {
  const streetOnly = String(h.street ?? "").replace(/\s+/g, " ").trim();
  const noLast = streetWithoutLastWord(h.street);
  const list = [];
  if (noLast) {
    list.push(noLast);
  }
  if (streetOnly) list.push(streetOnly);
  return [...new Set(list)];
}

/**
 * Prodigy search responses usually expose account/property id as `pid` on each row.
 */
function extractPidFromSearchJson(json) {
  if (json == null || typeof json !== "object") return null;

  const rowPid = (row) => {
    if (!row || typeof row !== "object") return null;
    const p =
      row.pid ??
      row.PID ??
      row.propId ??
      row.PropId ??
      row.propertyId ??
      row.propertyID ??
      row.parcelId ??
      row.ParcelId ??
      row.taxAccountId ??
      row.accountId ??
      row.row_to_json?.pid ??
      row.row_to_json?.PID ??
      row.row_to_json?.propId;
    if (p != null && String(p).match(/^\d{5,12}$/)) return String(p);
    return null;
  };

  if (Array.isArray(json.results) && json.results.length > 0) {
    for (const row of json.results) {
      const p = rowPid(row);
      if (p) return p;
    }
  }
  if (json.results && typeof json.results === "object" && !Array.isArray(json.results)) {
    const inner = json.results.results ?? json.results.rows ?? json.results.data;
    if (Array.isArray(inner) && inner.length > 0) {
      for (const row of inner) {
        const p = rowPid(row);
        if (p) return p;
      }
    }
  }

  const found = [];
  function walk(o, depth) {
    if (depth > 22 || o == null) return;
    if (typeof o !== "object") return;
    if (Array.isArray(o)) {
      for (const x of o) walk(x, depth + 1);
      return;
    }
    if (o.pid != null && String(o.pid).match(/^\d{5,12}$/)) {
      found.push(String(o.pid));
    }
    for (const k of Object.keys(o)) {
      if (k === "geometry" || k === "features") continue;
      walk(o[k], depth + 1);
    }
  }
  walk(json, 0);
  return found[0] ?? null;
}

function extractPidFromCaptured(captured) {
  const searchFirst = captured.filter((c) =>
    /search|abstract|parcel|property|account|query|graphql|grid|results|lookup/i.test(c.url),
  );
  const ordered = [...searchFirst, ...captured.filter((c) => !searchFirst.includes(c))];
  for (const { json } of ordered) {
    const pid = extractPidFromSearchJson(json);
    if (pid) return pid;
  }
  return null;
}

async function tryFillQuickSearch(page, text) {
  const placeholders = [
    /Search by Account Number, Address or Owner Name/i,
    /Search by Property Address/i,
    /Quick Search/i,
    /Street Address/i,
  ];
  for (const re of placeholders) {
    const loc = page.getByPlaceholder(re).first();
    if ((await loc.count()) > 0) {
      await loc.waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
      await loc.click({ timeout: 5000 }).catch(() => {});
      await loc.fill("");
      await loc.fill(text);
      return true;
    }
  }
  const extra = [
    page.locator('input[placeholder*="Address" i]').first(),
    page.locator('input[placeholder*="Search" i]').first(),
    page.locator('input[aria-label*="Search" i]').first(),
    page.locator('input[type="search"]').first(),
  ];
  for (const loc of extra) {
    if ((await loc.count()) > 0) {
      await loc.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
      await loc.click({ timeout: 5000 }).catch(() => {});
      await loc.fill("");
      await loc.fill(text);
      return true;
    }
  }
  const rootInput = page.locator("#root input").filter({ visible: true });
  const n = await rootInput.count();
  if (n > 0) {
    const inp = rootInput.first();
    await inp.click().catch(() => {});
    await inp.fill("");
    await inp.fill(text);
    return true;
  }
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const finp = frame.locator("input").filter({ visible: true }).first();
    if ((await finp.count()) > 0) {
      await finp.click().catch(() => {});
      await finp.fill("");
      await finp.fill(text);
      return true;
    }
  }
  return false;
}

async function clickSearchSubmit(page) {
  const wrapBtn = page.locator(".ch-search-wrapper button").first();
  if ((await wrapBtn.count()) > 0) {
    await wrapBtn.click({ timeout: 5000 }).catch(() => {});
    return;
  }
  await page.getByRole("button", { name: /search/i }).first().click({ timeout: 5000 }).catch(() => {});
}

/** Start before clicking Search — first search-related API hit or result link after submit. */
function startSearchOutcomeWait(page) {
  const api = page
    .waitForResponse(
      (r) =>
        r.url().includes("trueprodigyapi.com") &&
        r.status() === 200 &&
        /search|property|parcel|account|query|grid|lookup|abstract|graphql/i.test(r.url()),
      { timeout: 45000 },
    )
    .catch(() => null);
  const link = page
    .waitForSelector('a[href*="/property-detail/"]', { state: "attached", timeout: 35000 })
    .catch(() => null);
  return Promise.race([api, link]);
}

function attachSearchCapture(page, captured) {
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("trueprodigyapi.com")) return;
    try {
      const text = await response.text();
      if (!text || text.length > 2_000_000) return;
      const t = text.trim();
      if (t[0] !== "{" && t[0] !== "[") return;
      const json = JSON.parse(t);
      captured.push({ url, json });
    } catch {
      /* ignore */
    }
  });
}

/**
 * One fresh page per query string so JSON captures don’t mix between attempts.
 */
async function resolveCadPropertyId(browser, home, debug) {
  const variants = formatSearchQueryVariants(home);
  let lastCaptured = [];

  for (const q of variants) {
    let context;
    try {
      context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        locale: "en-US",
      });
      const page = await context.newPage();
      await page.setViewportSize({ width: 1400, height: 900 });
      const captured = [];
      attachSearchCapture(page, captured);

      await page.goto("https://travis.prodigycad.com/property-search", {
        waitUntil: "load",
        timeout: 120000,
      });
      await page.waitForSelector("#root", { state: "attached", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 9000));

      const filled = await tryFillQuickSearch(page, q);
      if (!filled) {
        const html = await page.content();
        fs.writeFileSync(resolveDebugHtmlPath, html.slice(0, 800_000), "utf8");
        await context.close();
        continue;
      }

      const outcome = startSearchOutcomeWait(page);
      await clickSearchSubmit(page);
      await page.keyboard.press("Enter");
      await outcome;
      await new Promise((r) => setTimeout(r, 2000));
      await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 4000));

      let pid = extractPidFromCaptured(captured);
      lastCaptured = captured;

      if (!pid) {
        const link = page.locator('a[href*="/property-detail/"]').first();
        if ((await link.count()) > 0) {
          const href = await link.getAttribute("href");
          const m = href?.match(/property-detail\/(\d+)/);
          if (m) pid = m[1];
        }
      }

      if (!pid) {
        const dataRow = page.locator('[role="row"]').nth(1);
        if ((await dataRow.count()) > 0) {
          const nav = page.waitForURL(/property-detail\/\d+/i, { timeout: 35000 });
          await dataRow.click({ timeout: 10000 }).catch(() => {});
          await nav.catch(() => {});
          const u = page.url();
          const m2 = u.match(/property-detail\/(\d+)/i);
          if (m2) pid = m2[1];
        }
      }

      try {
        fs.writeFileSync(resolveSearchJsonPath, JSON.stringify(lastCaptured.slice(0, 50), null, 2), "utf8");
      } catch {
        /* ignore */
      }

      if (pid) {
        await context.close();
        return pid;
      }

      const html = await page.content();
      fs.writeFileSync(resolveDebugHtmlPath, html.slice(0, 800_000), "utf8");
      await context.close();
    } catch (e) {
      console.error("resolve attempt error:", e?.message ?? e);
      await context?.close().catch(() => {});
    }
  }

  if (debug && lastCaptured.length) {
    fs.writeFileSync(resolveSearchJsonPath, JSON.stringify(lastCaptured.slice(0, 50), null, 2), "utf8");
  }

  return null;
}

async function captureAppraisalForProperty(browser, propertyId, debug) {
  const page = await browser.newPage();
  const payloads = [];
  attachJsonListener(page, payloads);

  try {
    const url = `https://travis.prodigycad.com/property-detail/${propertyId}/`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await new Promise((r) => setTimeout(r, PAGE_WAIT_MS));
    await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));

    const rows = [];
    for (const p of payloads) {
      extractProdigyValueHistory(p, rows);
      extractRows(p, rows);
    }

    const merged = mergeByYear(rows);
    const builder = extractBuilderFromPayloads(payloads);

    if (merged.length === 0 && debug && payloads.length > 0) {
      fs.writeFileSync(debugPath, JSON.stringify(payloads.slice(0, 8), null, 2), "utf8");
    }
    if (debug && !builder && payloads.length > 0) {
      const preview = [];
      for (const p of payloads.slice(0, 4)) {
        const recs = [];
        gatherBuyerRecords(p, recs, 0);
        preview.push({ recCount: recs.length, sample: recs.slice(0, 5) });
      }
      fs.writeFileSync(
        path.join(root, "data", "last-builder-debug.json"),
        JSON.stringify({ propertyId, preview }, null, 2),
        "utf8",
      );
    }

    return { appraisalHistory: merged, builder };
  } finally {
    await page.close();
  }
}

function saveHomes(raw) {
  raw.meta = raw.meta || {};
  raw.meta.appraisalImportAt = new Date().toISOString();
  raw.meta.count = raw.homes.length;
  fs.writeFileSync(homesPath, JSON.stringify(raw, null, 2) + "\n", "utf8");
}

async function main() {
  const { appraisalLimit, resolveLimit, dryRun, resolveIds, appraisalsOnly, debug, headed } = parseArgs();
  const raw = JSON.parse(fs.readFileSync(homesPath, "utf8"));
  const idMerge = loadIdMerge();

  for (const h of raw.homes) {
    if (idMerge[h.id] && !h.cadPropertyId) {
      h.cadPropertyId = String(idMerge[h.id]);
    }
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: !headed,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    if (resolveIds && !appraisalsOnly) {
      const needId = raw.homes.filter((h) => !String(h.cadPropertyId ?? "").trim());
      const toResolve = needId.slice(0, resolveLimit);
      console.log(
        `Resolve CAD ids: ${needId.length} missing, will process ${toResolve.length} (resolve-limit=${resolveLimit === Infinity ? "∞" : resolveLimit}).`,
      );

      let ri = 0;
      for (const h of toResolve) {
        ri++;
        console.log(`[resolve ${ri}/${toResolve.length}] ${h.id} ${h.street}`);
        if (dryRun) continue;
        const id = await resolveCadPropertyId(browser, h, debug);
        if (id) {
          h.cadPropertyId = id;
          console.log(`   → cadPropertyId ${id}`);
          saveHomes(raw);
        } else {
          console.warn(`   → could not resolve (check data/last-resolve-debug.html if --debug)`);
        }
        if (ri < toResolve.length) await new Promise((r) => setTimeout(r, DELAY_RESOLVE_MS));
      }
    }

    const withId = raw.homes.filter((h) => String(h.cadPropertyId ?? "").trim());
    const slice = withId.slice(0, appraisalLimit);

    console.log(
      `Import appraisals: ${withId.length} homes have cadPropertyId; running ${slice.length} (limit=${appraisalLimit === Infinity ? "∞" : appraisalLimit}).`,
    );

    let n = 0;
    for (const h of slice) {
      n++;
      const pid = String(h.cadPropertyId).trim();
      console.log(`[appraisal ${n}/${slice.length}] ${h.id}  CAD ${pid}  ${h.street}`);
      if (dryRun) continue;

      const { appraisalHistory, builder } = await captureAppraisalForProperty(browser, pid, debug);
      if (appraisalHistory.length === 0) {
        console.warn(`   No appraisal rows parsed. Try --debug (see ${debugPath}).`);
      } else {
        h.appraisalHistory = appraisalHistory;
        console.log(`   Years: ${appraisalHistory.map((r) => r.year).join(", ")}`);
      }
      if (builder) {
        h.builder = builder;
        console.log(`   Builder (buyer @ oldest appraisal date): ${builder}`);
      } else if (debug) {
        console.warn(`   No builder extracted (see data/last-builder-debug.json if present).`);
      }
      if (appraisalHistory.length > 0 || builder) {
        saveHomes(raw);
      }

      if (n < slice.length) await new Promise((r) => setTimeout(r, DELAY_APPRAISAL_MS));
    }

    if (!dryRun) {
      saveHomes(raw);
      console.log(`Done. Wrote ${homesPath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
