#!/usr/bin/env node
/**
 * Read utility provider rows from SummitInfo.xlsx (or another workbook) and write src/data/utilities.json.
 *
 * Expected: a sheet named "Utilities" with header row:
 *   (category) | Provider Name | Website | Outage Status | Phone | Billing
 * First column is the utility category (Electric, Water, Trash, Gas, HOA, …).
 *
 * Usage:
 *   node scripts/parse-utilities-from-excel.mjs
 *   node scripts/parse-utilities-from-excel.mjs --input ./path/to/file.xlsx --out ./src/data/utilities.json
 *   node scripts/parse-utilities-from-excel.mjs --stdout
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

function parseArgs(argv) {
  const out = { input: null, out: null, stdout: false, sheet: "Utilities" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--stdout") out.stdout = true;
    else if (a === "--input" && argv[i + 1]) out.input = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--sheet" && argv[i + 1]) out.sheet = argv[++i];
  }
  return out;
}

function defaultInputPath() {
  const candidates = [
    path.join(repoRoot, "src", "data", "SummitInfo.xlsx"),
    path.join(repoRoot, "data", "SummitInfo.xlsx"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && !path.basename(p).startsWith("~$")) return p;
  }
  return candidates[0];
}

function defaultOutPath() {
  return path.join(repoRoot, "src", "data", "utilities.json");
}

/** @param {unknown} v */
function cell(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseUtilitiesSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    const names = workbook.SheetNames?.join(", ") || "(none)";
    throw new Error(`Sheet "${sheetName}" not found. Available: ${names}`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  if (rows.length < 2) {
    throw new Error(`Sheet "${sheetName}" has no data rows.`);
  }

  const header = rows[0].map((c) => cell(c) ?? "");

  const utilities = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const category = cell(row[0]);
    const providerName = cell(row[1]);
    const website = cell(row[2]);
    const outageStatus = cell(row[3]);
    const phone = cell(row[4]);
    const billing = cell(row[5]);

    if (!category && !providerName && !website && !outageStatus && !phone && !billing) {
      continue;
    }

    utilities.push({
      category: category ?? "",
      providerName,
      website,
      outageStatus,
      phone,
      billing,
    });
  }

  return { utilities, header };
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(args.input || defaultInputPath());
  const outPath = args.out ? path.resolve(args.out) : defaultOutPath();

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    console.error("Place SummitInfo.xlsx in src/data/ or data/, or pass --input.");
    process.exit(1);
  }

  const workbook = XLSX.readFile(inputPath);
  const { utilities, header } = parseUtilitiesSheet(workbook, args.sheet);

  const payload = {
    meta: {
      sourceFile: path.relative(repoRoot, inputPath).replace(/\\/g, "/"),
      sheet: args.sheet,
      parsedAt: new Date().toISOString(),
      headerRow: header,
    },
    utilities,
  };

  const json = JSON.stringify(payload, null, 2) + "\n";

  if (args.stdout) {
    process.stdout.write(json);
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json, "utf8");
  console.log(`Wrote ${outPath} (${utilities.length} utility rows from ${path.basename(inputPath)}).`);
}

main();
