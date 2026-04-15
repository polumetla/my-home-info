#!/usr/bin/env node
/**
 * Add `builder`, `squareFeet`, `solar`, and `yearBuilt` keys to every home in homes.json (null if absent).
 * Run after pulling changes or editing homes by hand so the file shape matches what the CAD import writes.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const homesPath = path.join(__dirname, "..", "src", "data", "homes.json");

const raw = JSON.parse(fs.readFileSync(homesPath, "utf8"));
if (!Array.isArray(raw.homes)) {
  console.error("Invalid homes.json: missing homes array");
  process.exit(1);
}
for (const h of raw.homes) {
  if (h == null || typeof h !== "object") continue;
  if (!Object.prototype.hasOwnProperty.call(h, "builder")) h.builder = null;
  if (!Object.prototype.hasOwnProperty.call(h, "squareFeet")) h.squareFeet = null;
  if (!Object.prototype.hasOwnProperty.call(h, "solar")) h.solar = null;
  if (!Object.prototype.hasOwnProperty.call(h, "yearBuilt")) h.yearBuilt = null;
}
raw.meta = raw.meta || {};
raw.meta.count = raw.homes.length;
fs.writeFileSync(homesPath, JSON.stringify(raw, null, 2) + "\n", "utf8");
console.log(`Wrote ${homesPath} (${raw.homes.length} homes, CAD fields normalized).`);
