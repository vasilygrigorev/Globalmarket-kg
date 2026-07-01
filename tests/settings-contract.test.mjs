// Storefront settings contract — no network, no browser.
// The live storefront reads store config from public-catalog.json `settings`
// (app.js merges it over hardcoded fallbacks). This guards that the shipped
// catalog carries valid public settings and stays consistent with the
// data/settings.json source of truth, so the WhatsApp order fallback, the
// registration discount, and the free-delivery threshold reflect real config.
// Run: node --test tests/settings-contract.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const publicSettings = (JSON.parse(read("data/public-catalog.json")).settings) || {};
const sourceSettings = JSON.parse(read("data/settings.json")) || {};

// Fields the public storefront actually depends on (see app.js catalogSettings).
const PUBLIC_FIELDS = [
  "manager_whatsapp",
  "default_registered_discount_percent",
  "free_delivery_threshold_kgs",
];

test("public catalog ships the public settings fields", () => {
  const missing = PUBLIC_FIELDS.filter((f) => publicSettings[f] === undefined || publicSettings[f] === null);
  assert.deepEqual(missing, [], `public-catalog settings missing: ${missing.join(", ")}`);
});

test("manager WhatsApp is a plausible international phone number", () => {
  const phone = String(publicSettings.manager_whatsapp || "");
  const digits = phone.replace(/\D/g, "");
  assert.ok(phone.startsWith("+"), "manager_whatsapp should be in +<country> format");
  assert.ok(digits.length >= 10 && digits.length <= 15, `unexpected phone length: ${digits.length}`);
});

test("registration discount is a sane percentage", () => {
  const d = Number(publicSettings.default_registered_discount_percent);
  assert.ok(Number.isFinite(d) && d >= 0 && d <= 90, `discount out of range: ${d}`);
});

test("free-delivery threshold is a positive amount", () => {
  const t = Number(publicSettings.free_delivery_threshold_kgs);
  assert.ok(Number.isFinite(t) && t > 0, `threshold not positive: ${t}`);
});

test("public settings agree with data/settings.json source of truth", () => {
  const bad = [];
  for (const f of PUBLIC_FIELDS) {
    if (sourceSettings[f] === undefined) continue; // source may omit; only compare when present
    if (Number(sourceSettings[f]) === Number(sourceSettings[f]) && !Number.isNaN(Number(sourceSettings[f]))) {
      if (Number(publicSettings[f]) !== Number(sourceSettings[f])) bad.push(`${f}: ${publicSettings[f]} != ${sourceSettings[f]}`);
    } else if (String(publicSettings[f]) !== String(sourceSettings[f])) {
      bad.push(`${f}: ${publicSettings[f]} != ${sourceSettings[f]}`);
    }
  }
  assert.deepEqual(bad, [], `public/source settings drift: ${bad.join(", ")}`);
});
