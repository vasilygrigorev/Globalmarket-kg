import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const home = read("index.html");
const wholesale = read("opt/index.html");
const wholesaleJs = read("assets/wholesale.js");
const consentJs = read("assets/google-consent.js");

test("homepage wholesale entry is compact and follows fresh products", () => {
  assert.ok(home.indexOf('id="freshProducts"') < home.indexOf('class="wholesale-home-entry"'));
  assert.ok(home.indexOf('class="wholesale-home-entry"') < home.indexOf('id="recentlyViewed"'));
  assert.match(home, /href="\/opt\/" data-wholesale-entry/);
  assert.match(read("assets/wholesale.css"), /\.wholesale-home-entry\s*\{[^}]*order:\s*3;/s);
});

test("wholesale landing is indexable, canonical, and targeted to Bishkek wholesale search", () => {
  assert.match(wholesale, /<title>Бытовая химия оптом в Бишкеке — Global Market KG<\/title>/);
  assert.match(wholesale, /name="robots" content="index,follow,max-image-preview:large"/);
  assert.match(wholesale, /rel="canonical" href="https:\/\/globalmarket\.kg\/opt\/"/);
  assert.match(wholesale, /<h1 id="wholesale-title">Бытовая химия оптом для магазинов<\/h1>/);
  assert.match(wholesale, /wholesale-production-v1/);
});

test("wholesale structured data identifies the organization, page, service, and breadcrumb", () => {
  const block = wholesale.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(block, "wholesale JSON-LD is missing");
  const data = JSON.parse(block[1]);
  const types = new Set((data["@graph"] || []).map((item) => item["@type"]));
  for (const type of ["Organization", "WebPage", "Service", "BreadcrumbList"]) {
    assert.ok(types.has(type), `${type} is missing from wholesale JSON-LD`);
  }
});

test("wholesale measurement records anonymous funnel events only", () => {
  assert.match(wholesaleJs, /track\("generate_lead", \{ method: "site_form", lead_type: "wholesale_application" \}\)/);
  assert.match(wholesaleJs, /gmkWholesaleLeadConversion/);
  assert.match(consentJs, /window\.gmkWholesaleLeadConversion/);
  assert.match(wholesaleJs, /track\("contact", \{ method: "wholesale_whatsapp", lead_type: "wholesale" \}\)/);
  assert.match(consentJs, /\[data-wholesale-entry\]/);
  assert.doesNotMatch(wholesaleJs, /track\("[^"\n]+"[^\n]*(phone|shop_name|name|address|comment)/);
});

test("build tooling includes wholesale analytics, sitemap, and package guards", () => {
  assert.match(read("scripts/sync_public_instrumentation.py"), /ROOT \/ "opt" \/ "index\.html"/);
  assert.match(read("scripts/generate_sitemap.py"), /\{BASE_URL\}\/opt\//);
  assert.match(read("scripts/verify_static_package.py"), /sitemap\.xml does not include wholesale landing page/);
  assert.match(read("scripts/verify_release_invariants.py"), /public wholesale landing page is missing/);
});
