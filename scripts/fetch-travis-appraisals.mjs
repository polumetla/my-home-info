#!/usr/bin/env node
/**
 * Travis County CAD (Prodigy) — import appraised values + history into src/data/homes.json
 *
 * Value history in Prodigy often uses **pYear** + **ownerAppraisedValue** (see portal charts),
 * not `year` + `appraisedValue`. This script captures JSON from trueprodigyapi.com in a real
 * browser session and extracts those fields.
 *
 * **Builder:** from sale/transfer JSON, uses the **buyer** on the row with the oldest
 * **appraisal date** when present; otherwise oldest sale/deed date or year. Stored value is the
 * **first word only** (uppercase), e.g. `WESTIN HOMES` → `WESTIN`, `DREES CUSTOM HOME` → `DREES`.
 * Exceptions (deed **seller**, case-insensitive substring): **`WESTIN`** → **`Westin Homes`**; **`DREES`** or **`DRESS`** (county typo) → **`Drees Custom Homes`**; **`ASHTON`** → **`Ashton Woods`** (first match wins).
 *
 * **Homestead:** general `results.exemptionList` text containing **HS** (comma-separated codes, e.g.
 * `HS - Homestead`), or exemption rows that match HS homestead patterns. Other mentions of "homestead"
 * outside exemptions are ignored.
 *
 * **Solar (SO):** general `results.exemptionList` text containing **SO** (e.g. `SO - Solar (Special Exemption)`),
 * or improvement rows with `imprvSpecificDescription` **SOLAR ARRAY SYSTEM**.
 *
 * **Pool:** improvement `results[].details[]` row whose **detailTypeDescription** contains **POOL**, or top-level `imprvDescription` / `imprvSpecificDescription` with a **POOL** token (e.g. `POOL RES CONC`).
 *
 * **Square feet:** largest **livingArea** among improvement `results` rows (CAD living area, whole sqft).
 *
 * **Year built:** improvement `results[].details[]` row with **detailTypeDescription** `HVAC RESIDENTIAL` uses **actualYearBuilt** (matches main structure year; avoids pool/solar add-on years).
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
 *   node scripts/fetch-travis-appraisals.mjs --no-cache (always fetch from CAD; ignore disk cache)
 *   node scripts/fetch-travis-appraisals.mjs --cache-max-age-days=14 (default 30; refetch when older)
 *   node scripts/fetch-travis-appraisals.mjs --reparse-only (re-run parsing from disk cache only; no browser)
 *   npm run ensure:homes-cad-fields  (add `builder` / `squareFeet` / `solar` keys with nulls where missing)
 *
 * **Raw cache:** For each property detail page, only Prodigy JSON whose URL matches known data endpoints is
 * stored under `byPid.<pid>.endpoints`: **deeds, general, features, improvement, land, taxable, value,
 * valuehistory** (see `CAD_PROPERTY_ENDPOINT_KEYS`). Parsed fields are built by flattening those blobs in
 * order, so you can change parsing without re-hitting CAD until the cache expires or you use --no-cache.
 * Legacy cache entries that used a flat `payloads` array are still read for `--reparse-only`.
 *
 * **Cache storage (avoids one huge JSON file):**
 * - Default: **sharded files** under `data/cad-appraisal-cache.d/<pid>.json` (one property per file).
 * - Optional **MongoDB** if `MONGODB_URI` is set (install driver: `npm install mongodb`). Use `MONGODB_DB`
 *   (default `my_home_info`) and `MONGODB_COLLECTION` (default `cad_prodigy_property_cache`).
 * - A legacy monolithic `data/cad-appraisal-cache.json` is migrated once into shards when the shard dir is empty.
 *
 * Optional merge file (gitignored): data/cad-property-ids.json
 * Shape: { "<home id>": "<cad property id>" }
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
/** In-repo writers: `saveHomes` here and `scripts/ensure-homes-cad-fields.mjs`. App code only reads (`homes.server.ts`). */
const homesPath = path.join(root, "src", "data", "homes.json");
const mergePath = path.join(root, "data", "cad-property-ids.json");
const debugPath = path.join(root, "data", "last-appraisal-debug.json");
const resolveSearchJsonPath = path.join(root, "data", "last-resolve-search.json");
const resolveDebugHtmlPath = path.join(root, "data", "last-resolve-debug.html");
const appraisalCacheDir = path.join(root, "data", "cad-appraisal-cache.d");
const legacyAppraisalCachePath = path.join(root, "data", "cad-appraisal-cache.json");

const DELAY_APPRAISAL_MS = 3500;
const DELAY_RESOLVE_MS = 2500;
const PAGE_WAIT_MS = 15000;

/** Prodigy blocks `/public/propertyaccount/*` with `net::ERR_FAILED` when User-Agent is HeadlessChrome. */
const PLAYWRIGHT_DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/** On-disk cache file schema (bump if `byPid` entry shape changes). */
const APPRAISAL_CACHE_FILE_VERSION = 3;

/** Order used when flattening cached endpoint JSON for parsers (matches portal data tabs). */
const CAD_PROPERTY_ENDPOINT_KEYS = [
  "deeds",
  "general",
  "features",
  "improvement",
  "land",
  "taxable",
  "value",
  "valuehistory",
];

/**
 * Classify by URL pathname. **Deeds** use `/public/property/{pid}/deeds` (pid = property id from the URL).
 * All other tab JSON uses `/public/propertyaccount/{pAccountID}/…` — **pAccountID** is not the same as pid;
 * resolve it from `public/property/search` using `pYear` = default tax year from `public/config/defaultyear`
 * (`results.year`), or the **last** search row for that pid if no row matches.
 * Features: `/public/propertyaccount/{pAccountID}/features` or nested
 * `/public/propertyaccount/improvement/{impId}/features`.
 * Order: most specific path first (valuehistory before value; nested features before flat features).
 */
const CAD_ENDPOINT_PATH_RULES = [
  [/\/public\/propertyaccount\/[^/]+\/valuehistory(?:\/|\?|$)/i, "valuehistory"],
  [/\/public\/propertyaccount\/improvement\/[^/]+\/features(?:\/|\?|$)/i, "features"],
  [/\/public\/propertyaccount\/[^/]+\/features(?:\/|\?|$)/i, "features"],
  [/\/public\/property\/[^/]+\/deeds(?:\/|\?|$)/i, "deeds"],
  [/\/public\/propertyaccount\/[^/]+\/general(?:\/|\?|$)/i, "general"],
  [/\/public\/propertyaccount\/[^/]+\/improvement(?:\/|\?|$)/i, "improvement"],
  [/\/public\/propertyaccount\/[^/]+\/land(?:\/|\?|$)/i, "land"],
  [/\/public\/propertyaccount\/[^/]+\/taxable(?:\/|\?|$)/i, "taxable"],
  [/\/public\/propertyaccount\/[^/]+\/value(?:\/|\?|$)/i, "value"],
];

/** Other trueprodigy JSON on the detail page (still flattened for parsers). */
const CAD_UNCLASSIFIED_KEY = "unclassified";

/** Travis CAD shows this under Exemptions (e.g. exemptionList); do not treat generic "homestead" text as HS. */
const HS_HOMESTEAD_LABEL_RE = /HS\s*[-–—]\s*Homestead\b/i;

/** Top-level improvement row text (e.g. "POOL RES CONC"). */
const IMPROVEMENT_POOL_RE = /\bPOOL\b/i;
/** Improvement detail row `detailTypeDescription` substring (e.g. "POOL RES CONC"). */
const DETAIL_TYPE_CONTAINS_POOL_RE = /POOL/i;

function improvementSpecificIsSolarArraySystem(value) {
  if (typeof value !== "string") return false;
  return value.replace(/\s+/g, " ").trim().toUpperCase() === "SOLAR ARRAY SYSTEM";
}

function parseArgs() {
  const args = process.argv.slice(2);
  let appraisalLimit = Infinity;
  let resolveLimit = Infinity;
  let dryRun = false;
  let resolveIds = true;
  let appraisalsOnly = false;
  let debug = false;
  let headed = false;
  let useCache = true;
  let cacheMaxAgeDays = 30;
  let reparseOnly = false;
  for (const a of args) {
    if (a === "--dry-run") dryRun = true;
    if (a === "--no-cache") useCache = false;
    if (a === "--reparse-only") reparseOnly = true;
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
    m = /^--cache-max-age-days=(\d+)$/.exec(a);
    if (m) cacheMaxAgeDays = Number.parseInt(m[1], 10);
  }
  return {
    appraisalLimit,
    resolveLimit,
    dryRun,
    resolveIds,
    appraisalsOnly,
    debug,
    headed,
    useCache,
    cacheMaxAgeDays,
    reparseOnly,
  };
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

/** First word of builder/buyer name for display (e.g. WESTIN HOMES → WESTIN). */
function formatBuilderDisplayName(raw) {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length < 2) return null;
  const first = t.split(/\s+/)[0]?.replace(/[,;.]+$/g, "") ?? "";
  if (first.length < 2) return null;
  return first.toUpperCase();
}

function normalizeCadPartyName(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Deed seller substring (uppercase) → display builder; earlier entries win over later ones. */
const DEED_SELLER_CANONICAL_BUILDERS = [
  { sellerContains: "WESTIN", builderLabel: "Westin Homes" },
  { sellerContains: "DREES", builderLabel: "Drees Custom Homes" },
  { sellerContains: "DRESS", builderLabel: "Drees Custom Homes" },
  { sellerContains: "ASHTON", builderLabel: "Ashton Woods" },
];

function walkPayloadForDeedSellerContains(obj, depth, sellerNeedleUpper) {
  if (depth > 26 || obj == null) return false;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      if (walkPayloadForDeedSellerContains(x, depth + 1, sellerNeedleUpper)) return true;
    }
    return false;
  }
  if (typeof obj !== "object") return false;
  const seller = obj.seller;
  if (typeof seller === "string" && normalizeCadPartyName(seller).includes(sellerNeedleUpper)) {
    return true;
  }
  for (const k of Object.keys(obj)) {
    if (k === "geometry" || k === "features") continue;
    if (walkPayloadForDeedSellerContains(obj[k], depth + 1, sellerNeedleUpper)) return true;
  }
  return false;
}

/** Buyer name on the oldest appraisal-dated row when available; else oldest sale/year. */
function extractBuilderFromPayloads(payloads) {
  for (const { sellerContains, builderLabel } of DEED_SELLER_CANONICAL_BUILDERS) {
    const needle = sellerContains.toUpperCase();
    for (const p of payloads) {
      if (walkPayloadForDeedSellerContains(p, 0, needle)) return builderLabel;
    }
  }
  const recs = [];
  for (const p of payloads) {
    gatherBuyerRecords(p, recs, 0);
  }
  if (recs.length === 0) return null;
  const withAppraisal = recs.filter((r) => r.kind === "appraisal");
  const buyerPool = withAppraisal.length > 0 ? withAppraisal : recs;
  buyerPool.sort((a, b) => a.ms - b.ms);
  return formatBuilderDisplayName(buyerPool[0].buyer);
}

function exemptionRowIsHsHomestead(row) {
  if (!row || typeof row !== "object") return false;
  const code = row.exemptionCd ?? row.exemptionCode ?? row.code ?? row.cd ?? row.exemptionType ?? row.typeCd;
  const desc =
    row.exemptionDescription ??
    row.description ??
    row.exemptionDesc ??
    row.name ??
    row.formDescription ??
    row.exemptionLabel ??
    "";
  const codeStr = typeof code === "string" ? code.trim() : "";
  const descStr = typeof desc === "string" ? desc : "";
  if (/^HS$/i.test(codeStr) && /homestead/i.test(descStr)) return true;
  if (HS_HOMESTEAD_LABEL_RE.test(descStr)) return true;
  if (HS_HOMESTEAD_LABEL_RE.test(`${codeStr} ${descStr}`.trim())) return true;
  return false;
}

/**
 * Homestead = yes when general (or any) payload has `exemptionList` containing the substring `HS`, or
 * exemption rows match HS homestead patterns; avoids unrelated "homestead" text elsewhere in JSON.
 */
function extractHomesteadYesNoFromPayloads(payloads) {
  for (const p of payloads) {
    if (walkPayloadForHsHomestead(p, 0)) return "yes";
  }
  return "no";
}

function walkPayloadForHsHomestead(obj, depth) {
  if (depth > 28 || obj == null) return false;
  if (typeof obj !== "object") return false;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      if (walkPayloadForHsHomestead(x, depth + 1)) return true;
    }
    return false;
  }

  for (const k of Object.keys(obj)) {
    const kl = k.toLowerCase();
    const v = obj[k];

    if (kl === "exemptionlist" && typeof v === "string") {
      const plain = v.includes("<") ? v.replace(/<[^>]*>/g, " ") : v;
      if (plain.includes("HS")) return true;
    }

    if (Array.isArray(v) && kl.includes("exemption")) {
      for (const row of v) {
        if (exemptionRowIsHsHomestead(row)) return true;
      }
    }

    if (walkPayloadForHsHomestead(v, depth + 1)) return true;
  }
  return false;
}

/** Solar: `exemptionList` contains **SO**, or improvement `imprvSpecificDescription` is **SOLAR ARRAY SYSTEM**. */
function extractSolarYesNoFromPayloads(payloads) {
  for (const p of payloads) {
    if (walkPayloadForSolarYes(p, 0)) return "yes";
  }
  return "no";
}

function walkPayloadForSolarYes(obj, depth) {
  if (depth > 28 || obj == null) return false;
  if (typeof obj !== "object") return false;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      if (walkPayloadForSolarYes(x, depth + 1)) return true;
    }
    return false;
  }

  for (const k of Object.keys(obj)) {
    const kl = k.toLowerCase();
    const v = obj[k];

    if (kl === "exemptionlist" && typeof v === "string") {
      const plain = v.includes("<") ? v.replace(/<[^>]*>/g, " ") : v;
      if (plain.includes("SO")) return true;
    }

    if (kl === "imprvspecificdescription" || kl === "imprv_specific_description") {
      if (improvementSpecificIsSolarArraySystem(v)) return true;
    }

    if (walkPayloadForSolarYes(v, depth + 1)) return true;
  }
  return false;
}

function parseLivingAreaToSqft(value) {
  if (value == null) return null;
  const n =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function walkLivingAreaMax(obj, depth, state) {
  if (depth > 28 || obj == null) return;
  if (Array.isArray(obj)) {
    for (const x of obj) walkLivingAreaMax(x, depth + 1, state);
    return;
  }
  if (typeof obj !== "object") return;
  if (Object.prototype.hasOwnProperty.call(obj, "livingArea")) {
    const n = parseLivingAreaToSqft(obj.livingArea);
    if (n != null && n > state.max) state.max = n;
  }
  for (const k of Object.keys(obj)) {
    if (k === "geometry" || k === "features") continue;
    walkLivingAreaMax(obj[k], depth + 1, state);
  }
}

/** Max `livingArea` from improvement results (multiple rows: e.g. dwelling vs outbuilding with 0). */
function extractSquareFeetFromImprovementLivingArea(payloads) {
  const state = { max: 0 };
  for (const p of payloads) {
    walkLivingAreaMax(p, 0, state);
  }
  return state.max > 0 ? state.max : null;
}

const HVAC_RESIDENTIAL_DETAIL = "HVAC RESIDENTIAL";

function detailTypeDescriptionIsHvacResidential(value) {
  if (typeof value !== "string") return false;
  return value.replace(/\s+/g, " ").trim().toUpperCase() === HVAC_RESIDENTIAL_DETAIL;
}

function parseActualYearBuiltToInt(value) {
  if (value == null) return null;
  const n =
    typeof value === "number"
      ? Math.trunc(value)
      : Number.parseInt(String(value).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n < 1600 || n > 2100) return null;
  return n;
}

function walkHvacResidentialYearBuilt(obj, depth) {
  if (depth > 28 || obj == null) return null;
  if (typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const y = walkHvacResidentialYearBuilt(x, depth + 1);
      if (y != null) return y;
    }
    return null;
  }
  if (detailTypeDescriptionIsHvacResidential(obj.detailTypeDescription)) {
    const y = parseActualYearBuiltToInt(obj.actualYearBuilt);
    if (y != null) return y;
  }
  for (const k of Object.keys(obj)) {
    if (k === "geometry" || k === "features") continue;
    const y = walkHvacResidentialYearBuilt(obj[k], depth + 1);
    if (y != null) return y;
  }
  return null;
}

/** `actualYearBuilt` on improvement detail row where `detailTypeDescription` is `HVAC RESIDENTIAL`. */
function extractYearBuiltFromHvacResidentialDetail(payloads) {
  for (const p of payloads) {
    const y = walkHvacResidentialYearBuilt(p, 0);
    if (y != null) return y;
  }
  return null;
}

function extractPoolYesNoFromPayloads(payloads) {
  for (const p of payloads) {
    if (walkPayloadForPoolImprovement(p, 0)) return "yes";
  }
  return "no";
}

function walkPayloadForPoolImprovement(obj, depth) {
  if (depth > 28 || obj == null) return false;
  if (typeof obj !== "object") return false;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      if (walkPayloadForPoolImprovement(x, depth + 1)) return true;
    }
    return false;
  }

  for (const k of Object.keys(obj)) {
    const kl = k.toLowerCase();
    if (kl === "detailtypedescription") {
      const v = obj[k];
      if (typeof v === "string" && DETAIL_TYPE_CONTAINS_POOL_RE.test(v)) return true;
    }
    if (
      kl === "imprvdescription" ||
      kl === "imprvspecificdescription" ||
      kl === "imprv_description" ||
      kl === "imprv_specific_description"
    ) {
      const v = obj[k];
      if (typeof v === "string" && IMPROVEMENT_POOL_RE.test(v)) return true;
    }
  }
  for (const k of Object.keys(obj)) {
    if (walkPayloadForPoolImprovement(obj[k], depth + 1)) return true;
  }
  return false;
}

function loadIdMerge() {
  if (!fs.existsSync(mergePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(mergePath, "utf8"));
  } catch {
    return {};
  }
}

/** Lazy-read legacy single-file cache (before shard migration). */
let legacyMonolithicBody = undefined;

function readLegacyMonolithicBody() {
  if (legacyMonolithicBody !== undefined) return legacyMonolithicBody;
  if (!fs.existsSync(legacyAppraisalCachePath)) {
    legacyMonolithicBody = null;
    return null;
  }
  try {
    legacyMonolithicBody = JSON.parse(fs.readFileSync(legacyAppraisalCachePath, "utf8"));
    return legacyMonolithicBody;
  } catch {
    legacyMonolithicBody = null;
    return null;
  }
}

function cadCacheShardFilename(pid) {
  const id = String(pid).replace(/\D/g, "");
  return id ? `${id}.json` : "";
}

function loadFsShardEntry(pid) {
  const file = cadCacheShardFilename(pid);
  if (!file) return null;
  const shard = path.join(appraisalCacheDir, file);
  if (!fs.existsSync(shard)) return null;
  try {
    return JSON.parse(fs.readFileSync(shard, "utf8"));
  } catch {
    return null;
  }
}

function loadFsCacheEntry(pid) {
  const fromShard = loadFsShardEntry(pid);
  if (fromShard) return fromShard;
  const legacy = readLegacyMonolithicBody();
  if (legacy?.byPid && typeof legacy.byPid === "object") {
    return legacy.byPid[pid] ?? null;
  }
  return null;
}

function saveFsCacheEntry(pid, entry) {
  const file = cadCacheShardFilename(pid);
  if (!file) return;
  fs.mkdirSync(appraisalCacheDir, { recursive: true });
  const out = { ...entry, v: entry.v ?? APPRAISAL_CACHE_FILE_VERSION };
  fs.writeFileSync(path.join(appraisalCacheDir, file), JSON.stringify(out, null, 2) + "\n", "utf8");
}

function shardedCacheDirHasEntries() {
  if (!fs.existsSync(appraisalCacheDir)) return false;
  return fs.readdirSync(appraisalCacheDir).some((f) => f.endsWith(".json"));
}

function migrateLegacyMonolithicToShardsIfNeeded() {
  if (!fs.existsSync(legacyAppraisalCachePath) || shardedCacheDirHasEntries()) return;
  const body = readLegacyMonolithicBody();
  if (!body?.byPid || typeof body.byPid !== "object") return;
  let n = 0;
  for (const [pid, entry] of Object.entries(body.byPid)) {
    saveFsCacheEntry(pid, entry);
    n++;
  }
  try {
    fs.renameSync(legacyAppraisalCachePath, `${legacyAppraisalCachePath}.migrated.bak`);
  } catch (e) {
    console.warn("Could not rename legacy cache after migration:", e?.message ?? e);
    return;
  }
  legacyMonolithicBody = null;
  console.log(
    `Migrated ${n} CAD cache rows to ${path.relative(root, appraisalCacheDir)}/; legacy → cad-appraisal-cache.json.migrated.bak`,
  );
}

/**
 * @returns {{ backend: string, load: (pid: string) => Promise<object|null>, save: (pid: string, entry: object) => Promise<void>, close: () => Promise<void> }}
 */
async function createCadCacheStore() {
  const uri = process.env.MONGODB_URI?.trim();
  if (uri) {
    let MongoClient;
    try {
      ({ MongoClient } = await import("mongodb"));
    } catch {
      console.error("MONGODB_URI is set but the `mongodb` package is missing. Run: npm install mongodb");
      process.exit(1);
    }
    const client = new MongoClient(uri);
    await client.connect();
    const dbName = process.env.MONGODB_DB?.trim() || "my_home_info";
    const colName = process.env.MONGODB_COLLECTION?.trim() || "cad_prodigy_property_cache";
    const col = client.db(dbName).collection(colName);
    return {
      backend: "mongodb",
      async load(pid) {
        const doc = await col.findOne({ _id: String(pid) });
        return doc?.cache ?? null;
      },
      async save(pid, entry) {
        await col.replaceOne(
          { _id: String(pid) },
          { _id: String(pid), cache: entry, updatedAt: new Date() },
          { upsert: true },
        );
      },
      async close() {
        await client.close();
      },
    };
  }

  migrateLegacyMonolithicToShardsIfNeeded();
  return {
    backend: "fs-shards",
    async load(pid) {
      return loadFsCacheEntry(pid);
    },
    async save(pid, entry) {
      saveFsCacheEntry(pid, entry);
    },
    async close() {},
  };
}

function emptyCadEndpointsBuckets() {
  const o = Object.fromEntries(CAD_PROPERTY_ENDPOINT_KEYS.map((k) => [k, []]));
  o[CAD_UNCLASSIFIED_KEY] = [];
  return o;
}

function classifyCadPropertyDetailEndpoint(url) {
  const u = String(url);
  if (!u.toLowerCase().includes("trueprodigyapi.com")) return null;
  let pathname = "";
  try {
    pathname = new URL(u).pathname;
  } catch {
    return null;
  }
  const p = pathname.toLowerCase();
  for (const [re, key] of CAD_ENDPOINT_PATH_RULES) {
    if (re.test(p)) return key;
  }
  if (/\/public\/propertyaccount\//i.test(p) || /\/public\/property\//i.test(p)) {
    return CAD_UNCLASSIFIED_KEY;
  }
  return null;
}

function cadUrlPathname(url) {
  try {
    return new URL(String(url)).pathname;
  } catch {
    return "";
  }
}

/** Latest roll year from `GET …/public/config/defaultyear` (e.g. `{ results: { year: 2026 } }`). */
function extractDefaultYearFromProdigyConfig(json) {
  if (json == null || typeof json !== "object") return null;
  const y =
    json.results?.year ??
    json.results?.defaultYear ??
    json.year ??
    json.defaultYear ??
    json.defaultyear;
  if (typeof y === "number" && isYear(y)) return String(y);
  if (typeof y === "string" && /^\d{4}$/.test(y.trim())) return y.trim();
  return null;
}

function prodigySearchResultsArray(json) {
  if (json == null || typeof json !== "object") return [];
  const r = json.results;
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object" && Array.isArray(r.rows)) return r.rows;
  if (r && typeof r === "object" && Array.isArray(r.data)) return r.data;
  return [];
}

/**
 * Pick **pAccountID** for portal API paths, using search rows for this **pid** and optional default tax year.
 * Prefer the row whose `pYear` matches `defaultYear` (from defaultyear config); otherwise the last matching row.
 */
function pickPAccountIdForPidFromSearch(searchJson, propertyId, defaultYear) {
  const pid = String(propertyId ?? "").trim();
  if (!pid) return null;
  const rows = prodigySearchResultsArray(searchJson).filter(
    (row) => row && typeof row === "object" && String(row.pid) === pid,
  );
  if (rows.length === 0) return null;
  const dy = defaultYear != null && String(defaultYear).trim() !== "" ? String(defaultYear).trim() : null;
  if (dy) {
    const hit = rows.find((row) => String(row.pYear) === dy);
    if (hit != null && hit.pAccountID != null) return String(hit.pAccountID);
  }
  const last = rows[rows.length - 1];
  if (last?.pAccountID != null) return String(last.pAccountID);
  return null;
}

function slimCadEndpoints(endpoints) {
  const out = {};
  for (const k of [...CAD_PROPERTY_ENDPOINT_KEYS, CAD_UNCLASSIFIED_KEY]) {
    if (endpoints[k]?.length) out[k] = endpoints[k];
  }
  return out;
}

function formatEndpointCacheSummary(endpoints) {
  if (!endpoints || typeof endpoints !== "object") return "—";
  const keys = [...CAD_PROPERTY_ENDPOINT_KEYS, CAD_UNCLASSIFIED_KEY];
  const parts = keys.filter((k) => endpoints[k]?.length).map((k) => `${k}×${endpoints[k].length}`);
  return parts.length ? parts.join(", ") : "—";
}

function flattenCadEndpointsForParse(endpoints) {
  const out = [];
  if (!endpoints || typeof endpoints !== "object") return out;
  for (const k of CAD_PROPERTY_ENDPOINT_KEYS) {
    const arr = endpoints[k];
    if (Array.isArray(arr)) {
      for (const doc of arr) out.push(doc);
    }
  }
  const misc = endpoints[CAD_UNCLASSIFIED_KEY];
  if (Array.isArray(misc)) {
    for (const doc of misc) out.push(doc);
  }
  return out;
}

/** Flat `payloads[]` (legacy) or keyed `endpoints` → ordered array for extractors. */
function entryPayloadsForParse(entry) {
  if (!entry || typeof entry !== "object") return [];
  if (entry.endpoints && typeof entry.endpoints === "object") {
    return flattenCadEndpointsForParse(entry.endpoints);
  }
  if (Array.isArray(entry.payloads)) return [...entry.payloads];
  return [];
}

function rawCacheEntryHasPayloads(entry) {
  return entryPayloadsForParse(entry).length > 0;
}

async function persistRawCacheEntry(store, pid, endpointsBuckets) {
  const slim = slimCadEndpoints(endpointsBuckets);
  if (Object.keys(slim).length === 0) return;
  await store.save(pid, {
    cachedAt: new Date().toISOString(),
    endpoints: slim,
    v: APPRAISAL_CACHE_FILE_VERSION,
  });
}

function appraisalCacheEntryIsFresh(entry, maxAgeMs) {
  if (!entry || typeof entry.cachedAt !== "string") return false;
  const t = Date.parse(entry.cachedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= maxAgeMs;
}

function applyParsedCadToHome(h, parsed) {
  const { appraisalHistory, builder, homestead, solar, pool, squareFeet, yearBuilt } = parsed;
  if (appraisalHistory?.length) h.appraisalHistory = appraisalHistory;

  const nextBuilder =
    builder != null && String(builder).trim() !== "" ? String(builder).trim() : null;
  if (nextBuilder != null) {
    h.builder = nextBuilder;
  } else {
    const hadBuilder = typeof h.builder === "string" && h.builder.trim() !== "";
    if (!hadBuilder) h.builder = null;
  }

  if (homestead === "yes" || homestead === "no") h.homestead = homestead;
  if (solar === "yes" || solar === "no") h.solar = solar;
  if (pool === "yes" || pool === "no") h.pool = pool;

  if (typeof squareFeet === "number" && Number.isFinite(squareFeet)) {
    h.squareFeet = squareFeet;
  } else {
    const hadSqft = typeof h.squareFeet === "number" && Number.isFinite(h.squareFeet);
    if (!hadSqft) h.squareFeet = null;
  }

  if (typeof yearBuilt === "number" && Number.isFinite(yearBuilt)) {
    h.yearBuilt = yearBuilt;
  } else {
    const hadYb = typeof h.yearBuilt === "number" && Number.isFinite(h.yearBuilt);
    if (!hadYb) h.yearBuilt = null;
  }
}

/** Derive homes.json fields from cached trueprodigyapi JSON blobs (no browser). */
function parsePropertyPayloads(propertyId, payloads, debug) {
  const rows = [];
  for (const p of payloads) {
    extractProdigyValueHistory(p, rows);
    extractRows(p, rows);
  }
  const merged = mergeByYear(rows);
  const builder = extractBuilderFromPayloads(payloads);
  const homestead = extractHomesteadYesNoFromPayloads(payloads);
  const solar = extractSolarYesNoFromPayloads(payloads);
  const pool = extractPoolYesNoFromPayloads(payloads);
  const squareFeet = extractSquareFeetFromImprovementLivingArea(payloads);
  const yearBuilt = extractYearBuiltFromHvacResidentialDetail(payloads);

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

  return { appraisalHistory: merged, builder, homestead, solar, pool, squareFeet, yearBuilt };
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

/**
 * Buckets for property detail JSON (known routes + `unclassified` for other /public/property* calls).
 * Optionally fills `capture` with `defaultYear` (from defaultyear config) and `searchJson` for pAccountID resolution.
 */
function attachCadPropertyDetailResponseHandler(page, endpoints, capture) {
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.toLowerCase().includes("trueprodigyapi.com")) return;
    try {
      const text = await response.text();
      if (!text || text.length > 2_000_000) return;
      const t = text.trim();
      if (t[0] !== "{" && t[0] !== "[") return;
      const json = JSON.parse(t);
      if (capture) {
        const path = cadUrlPathname(url);
        const pl = path.toLowerCase();
        if (/\/public\/config\/defaultyear(?:\/|\?|$)/i.test(pl)) {
          const y = extractDefaultYearFromProdigyConfig(json);
          if (y) capture.defaultYear = y;
        }
        if (/\/public\/property\/search(?:\/|\?|$)/i.test(pl)) {
          capture.searchJson = json;
        }
      }
      const slot = classifyCadPropertyDetailEndpoint(url);
      if (!slot) return;
      endpoints[slot].push(json);
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

/** Open Prodigy property detail and collect JSON only for known CAD endpoint buckets. */
async function collectPropertyDetailPayloads(browserContext, propertyId) {
  const page = await browserContext.newPage();
  const endpoints = emptyCadEndpointsBuckets();
  const capture = { defaultYear: null, searchJson: null, pAccountId: null };
  attachCadPropertyDetailResponseHandler(page, endpoints, capture);
  try {
    const url = `https://travis.prodigycad.com/property-detail/${propertyId}/`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await new Promise((r) => setTimeout(r, PAGE_WAIT_MS));
    await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));
    capture.pAccountId = pickPAccountIdForPidFromSearch(
      capture.searchJson,
      propertyId,
      capture.defaultYear,
    );
    /** Loads `/public/propertyaccount/{pAccountID}/…` (general, value, land, …); deeds already load from `/public/property/{pid}/deeds`. */
    await page.locator("text=General").first().click({ timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 8000));
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    return { endpoints, pAccountId: capture.pAccountId, defaultYear: capture.defaultYear };
  } finally {
    await page.close();
  }
}

/** So `homes.json` always lists CAD-derived fields (null = unknown / not parsed yet). */
function ensureCadFieldsOnHomeRecords(homes) {
  if (!Array.isArray(homes)) return;
  for (const h of homes) {
    if (h == null || typeof h !== "object") continue;
    if (!Object.prototype.hasOwnProperty.call(h, "builder")) h.builder = null;
    if (!Object.prototype.hasOwnProperty.call(h, "squareFeet")) h.squareFeet = null;
    if (!Object.prototype.hasOwnProperty.call(h, "solar")) h.solar = null;
    if (!Object.prototype.hasOwnProperty.call(h, "yearBuilt")) h.yearBuilt = null;
  }
}

function saveHomes(raw) {
  raw.meta = raw.meta || {};
  raw.meta.appraisalImportAt = new Date().toISOString();
  raw.meta.count = raw.homes.length;
  ensureCadFieldsOnHomeRecords(raw.homes);
  const text = JSON.stringify(raw, null, 2) + "\n";
  const tmp = `${homesPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, homesPath);
}

async function main() {
  let {
    appraisalLimit,
    resolveLimit,
    dryRun,
    resolveIds,
    appraisalsOnly,
    debug,
    headed,
    useCache,
    cacheMaxAgeDays,
    reparseOnly,
  } = parseArgs();
  if (reparseOnly) {
    resolveIds = false;
    if (!useCache) {
      console.warn("Note: --reparse-only never contacts CAD; --no-cache has no effect on appraisal fetch.");
    }
  }
  const raw = JSON.parse(fs.readFileSync(homesPath, "utf8"));
  const idMerge = loadIdMerge();
  const cacheStore = await createCadCacheStore();
  console.log(`CAD cache backend: ${cacheStore.backend}`);
  const cacheMaxAgeMs = Math.max(0, cacheMaxAgeDays) * 86_400_000;

  for (const h of raw.homes) {
    if (idMerge[h.id] && !h.cadPropertyId) {
      h.cadPropertyId = String(idMerge[h.id]);
    }
  }

  /** In-memory only: avoid an extra full-file write here (races with editors) — `saveHomes` runs per home + at end. */
  if (!dryRun) ensureCadFieldsOnHomeRecords(raw.homes);

  let browser = null;
  /** BrowserContext with a desktop Chrome UA so propertyaccount XHR is not blocked (see PLAYWRIGHT_DESKTOP_CHROME_UA). */
  let appraisalContext = null;
  const getBrowser = async () => {
    if (!browser) {
      const { chromium } = await import("playwright");
      browser = await chromium.launch({
        headless: !headed,
        args: ["--disable-blink-features=AutomationControlled"],
      });
      appraisalContext = await browser.newContext({
        userAgent: PLAYWRIGHT_DESKTOP_CHROME_UA,
        viewport: { width: 1400, height: 900 },
        locale: "en-US",
      });
    }
    return browser;
  };
  const getAppraisalContext = async () => {
    await getBrowser();
    return appraisalContext;
  };

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
        const id = await resolveCadPropertyId(await getBrowser(), h, debug);
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
      `Import appraisals: ${withId.length} homes have cadPropertyId; running ${slice.length} (limit=${appraisalLimit === Infinity ? "∞" : appraisalLimit}). ${
        reparseOnly
          ? "Mode: REPARSE-ONLY (read cached JSON, no browser)."
          : `Raw JSON cache: ${useCache ? `on (max age ${cacheMaxAgeDays}d)` : "off (--no-cache)"}.`
      }`,
    );

    let n = 0;
    for (const h of slice) {
      n++;
      const pid = String(h.cadPropertyId).trim();
      console.log(`[appraisal ${n}/${slice.length}] ${h.id}  CAD ${pid}  ${h.street}`);
      if (dryRun) continue;

      const cached = await cacheStore.load(pid);
      let payloads;
      let usedNetwork = false;

      if (reparseOnly) {
        if (!rawCacheEntryHasPayloads(cached)) {
          console.warn(`   No raw JSON cache for ${pid}; skipping (run a normal import for this property).`);
          continue;
        }
        payloads = entryPayloadsForParse(cached);
        console.log(
          `   (reparse-only, cachedAt ${cached.cachedAt}) ${payloads.length} docs — ${cached.endpoints ? formatEndpointCacheSummary(cached.endpoints) : "legacy payloads[]"}`,
        );
      } else {
        const rawFresh =
          useCache &&
          cached &&
          rawCacheEntryHasPayloads(cached) &&
          appraisalCacheEntryIsFresh(cached, cacheMaxAgeMs);

        if (rawFresh) {
          payloads = entryPayloadsForParse(cached);
          console.log(
            `   (raw cache hit, cachedAt ${cached.cachedAt}; parsing locally) ${payloads.length} docs — ${cached.endpoints ? formatEndpointCacheSummary(cached.endpoints) : "legacy payloads[]"}`,
          );
        } else {
          usedNetwork = true;
          const { endpoints: collected, pAccountId, defaultYear } = await collectPropertyDetailPayloads(
            await getAppraisalContext(),
            pid,
          );
          if (pAccountId) {
            console.log(`   Prodigy pAccountID ${pAccountId} (roll year ${defaultYear ?? "—"} from defaultyear)`);
          }
          if (Object.keys(slimCadEndpoints(collected)).length > 0) {
            await persistRawCacheEntry(cacheStore, pid, collected);
            payloads = flattenCadEndpointsForParse(collected);
          } else if (rawCacheEntryHasPayloads(cached)) {
            console.warn(`   No new endpoint JSON captured; reusing existing cache for ${pid}.`);
            payloads = entryPayloadsForParse(cached);
            usedNetwork = false;
          } else {
            payloads = [];
          }
        }
      }

      if (!Array.isArray(payloads) || payloads.length === 0) {
        console.warn(`   No JSON payloads for ${pid}; skipping (nothing to parse).`);
        continue;
      }

      const parsed = parsePropertyPayloads(pid, payloads, debug);
      applyParsedCadToHome(h, parsed);

      if (!h.appraisalHistory?.length) {
        console.warn(`   No appraisal rows parsed. Try --debug (see ${debugPath}).`);
      } else {
        console.log(`   Years: ${h.appraisalHistory.map((r) => r.year).join(", ")}`);
      }
      if (h.builder) {
        console.log(`   Builder (buyer @ oldest appraisal date): ${h.builder}`);
      } else if (debug) {
        console.warn(`   No builder extracted (see data/last-builder-debug.json if present).`);
      }
      console.log(
        `   Homestead (HS): ${parsed.homestead}  Solar (SO): ${parsed.solar}  Pool: ${parsed.pool}  SQFT: ${parsed.squareFeet ?? "—"}  Year built (HVAC): ${parsed.yearBuilt ?? "—"}`,
      );
      saveHomes(raw);

      if (usedNetwork && n < slice.length) await new Promise((r) => setTimeout(r, DELAY_APPRAISAL_MS));
    }

    if (!dryRun) {
      saveHomes(raw);
      console.log(`Done. Wrote ${homesPath}`);
    }
  } finally {
    if (browser) await browser.close();
    await cacheStore.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
