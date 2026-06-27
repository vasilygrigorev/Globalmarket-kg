// Product card / product page consistency — no network, no browser.
// Ensures generated product pages use the same data as the catalog (so home cards
// and product pages can't diverge), the gallery card/front/back contract holds,
// perfume keeps a single card image, and each page has price + an order/oos action.
// Run: node --test tests/product-consistency.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const pages = JSON.parse(read("data/product-pages.json")).pages || [];
const products = JSON.parse(read("data/public-catalog.json")).products || [];
const byId = new Map(products.map((p) => [p.id, p]));
const firstImage = (p) => p.image || (p.galleryImages || [])[0] || "";
const samePath = (a, b) => String(a || "").replace(/^\/+/, "") === String(b || "").replace(/^\/+/, "");

test("product-pages manifest matches the catalog (unified data)", () => {
  const bad = [];
  for (const e of pages) {
    const p = byId.get(e.id);
    if (!p) { bad.push(`${e.id}: not in catalog`); continue; }
    if (e.title !== p.title) bad.push(`${e.id}: title`);
    if ((e.brand || "") !== (p.brand || "")) bad.push(`${e.id}: brand`);
    if (Number(e.retailPriceKgs) !== Number(p.retailPriceKgs)) bad.push(`${e.id}: price`);
    if (!samePath(e.image, firstImage(p))) bad.push(`${e.id}: image`);
  }
  assert.deepEqual(bad, [], `manifest/catalog mismatches: ${bad.slice(0, 6).join(", ")}`);
});

test("each generated product page reflects the catalog price", () => {
  const bad = [];
  for (const e of pages) {
    const file = join(ROOT, "product", e.slug, "index.html");
    if (!existsSync(file)) { bad.push(`${e.slug}: page missing`); continue; }
    const html = readFileSync(file, "utf8");
    const m = html.match(/const product = (\{.*?\});/s);
    if (!m) { bad.push(`${e.slug}: no embedded product`); continue; }
    let embedded;
    try { embedded = JSON.parse(m[1]); } catch { bad.push(`${e.slug}: bad JSON`); continue; }
    if (Number(embedded.price) !== Number(e.retailPriceKgs)) bad.push(`${e.slug}: price ${embedded.price}!=${e.retailPriceKgs}`);
  }
  assert.deepEqual(bad, [], `page price mismatches: ${bad.slice(0, 6).join(", ")}`);
});

test("gallery contract: card first + front + back for multi-image products", () => {
  const bad = [];
  for (const p of products) {
    const g = p.galleryImages || [];
    if (g.length < 2) continue;
    const names = g.map((i) => i.toLowerCase());
    if (!/card/.test(names[0])) bad.push(`${p.id}: first not card`);
    if (g.length >= 3) {
      if (!names.some((n) => n.includes("front"))) bad.push(`${p.id}: no front`);
      if (!names.some((n) => n.includes("back"))) bad.push(`${p.id}: no back`);
    }
  }
  assert.deepEqual(bad, [], `gallery contract issues: ${bad.slice(0, 6).join(", ")}`);
});

test("perfume products keep a single card image", () => {
  const perfume = products.filter((p) => p.category === "Парфюм 5 мл");
  assert.ok(perfume.length >= 1, "expected perfume products");
  const bad = perfume.filter((p) => {
    const g = p.galleryImages || (p.image ? [p.image] : []);
    return g.length !== 1 || !/card/i.test(g[0] || "");
  }).map((p) => p.id);
  assert.deepEqual(bad, [], `perfume not single card image: ${bad.join(", ")}`);
});

test("each product page has canonical, Product JSON-LD, price, related, and order/oos", () => {
  const bad = [];
  for (const e of pages) {
    const file = join(ROOT, "product", e.slug, "index.html");
    if (!existsSync(file)) { bad.push(`${e.slug}: missing`); continue; }
    const html = readFileSync(file, "utf8");
    if (!/rel="canonical"/.test(html)) bad.push(`${e.slug}: canonical`);
    if (!/"@type":\s*"Product"/.test(html)) bad.push(`${e.slug}: Product JSON-LD`);
    if (!/som-sign|сом/.test(html)) bad.push(`${e.slug}: price`);
    if (!/related|Похож/i.test(html)) bad.push(`${e.slug}: related`);
    if (!html.includes("data-add-cart") && !html.includes("Нет в наличии")) bad.push(`${e.slug}: order/oos`);
  }
  assert.deepEqual(bad, [], `page-level gaps: ${bad.slice(0, 6).join(", ")}`);
});
