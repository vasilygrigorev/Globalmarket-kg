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
  const wholesaleCss = read("assets/wholesale.css");
  assert.ok(home.indexOf('id="freshProducts"') < home.indexOf('class="wholesale-home-entry"'));
  assert.ok(home.indexOf('class="wholesale-home-entry"') < home.indexOf('id="recentlyViewed"'));
  assert.match(home, /href="\/opt\/" data-wholesale-entry/);
  assert.match(wholesaleCss, /\.wholesale-home-entry\s*\{[^}]*order:\s*3;/s);
  assert.match(
    wholesaleCss,
    /\.wholesale-home-link\s*\{[^}]*color:\s*#fff;[^}]*background:\s*linear-gradient\(135deg,\s*#009b91,\s*#007d7a\);/s,
  );
});

test("wholesale landing is indexable, canonical, and targeted to Bishkek wholesale search", () => {
  assert.match(wholesale, /<title>Бытовая химия оптом в Бишкеке — Global Market KG<\/title>/);
  assert.match(wholesale, /name="robots" content="index,follow,max-image-preview:large"/);
  assert.match(wholesale, /rel="canonical" href="https:\/\/globalmarket\.kg\/opt\/"/);
  assert.match(wholesale, /<h1 id="wholesale-title">Бытовая химия оптом для магазинов<\/h1>/);
  assert.match(wholesale, /wholesale-brand-logos-v1/);
});

test("official brand logos form a static two-row grid below the wordmark", () => {
  const headerEnd = wholesale.indexOf("</header>");
  const brands = wholesale.indexOf('class="wholesale-brand-showcase"');
  const hero = wholesale.indexOf('class="wholesale-hero"');
  assert.ok(headerEnd < brands && brands < hero, "brand showcase must be between the header and hero");
  for (const brand of ["Dalli", "Dash", "The Pink Stuff", "Felce Azzurra", "Dr. Beckmann", "Kamill", "Glysolid"]) {
    assert.match(wholesale, new RegExp(`alt="${brand.replace(".", "\\.")}"`));
  }
  for (const asset of [
    "/assets/brands/wholesale/dalli.webp",
    "/assets/brands/wholesale/dash.webp",
    "/assets/brands/wholesale/the-pink-stuff.webp",
    "/assets/brands/wholesale/felce-azzurra.webp",
    "/assets/brands/wholesale/dr-beckmann.webp",
    "/assets/brands/wholesale/kamill.webp",
    "/assets/brands/wholesale/glysolid.webp",
  ]) {
    assert.match(wholesale, new RegExp(asset.replaceAll("/", "\\/")));
  }
  const css = read("assets/wholesale.css");
  assert.match(css, /\.wholesale-brand-track\s*\{[^}]*grid-template-columns:\s*repeat\(8,/s);
  assert.match(css, /\.wholesale-brand-card:nth-child\(5\)\s*\{[^}]*grid-column:\s*2\s*\/\s*span\s*2/s);
  assert.doesNotMatch(css, /\.wholesale-brand-track\s*\{[^}]*overflow-x:\s*auto/s);
  assert.doesNotMatch(css, /\.wholesale-brand-track\s*\{[^}]*scroll-snap-type/s);
  assert.doesNotMatch(wholesale, /class="wholesale-brand-list"/);
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
