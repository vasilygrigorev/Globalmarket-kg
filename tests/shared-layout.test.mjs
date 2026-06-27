// Shared header/footer contract — no network, no browser.
// Ensures the header/footer come from the shared partials (not hand-diverged)
// across home, product, and landing/catalog pages, and that product pages keep a
// consistent action set and a real footer.
// Run: node --test tests/shared-layout.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const norm = (s) => s.replace(/\s+/g, " ").trim();

const headerPartial = read("partials/header.html");
const footerPartial = read("partials/footer.html");
const indexHtml = read("index.html");

const FOOTER_LINKS = ["/#catalog", "/catalog/", "/#checkout", "/privacy.html"];

function productPages() {
  const dir = join(ROOT, "product");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((s) => existsSync(join(dir, s, "index.html")))
    .map((s) => ({ slug: s, html: readFileSync(join(dir, s, "index.html"), "utf8") }));
}
function region(src, name) {
  const m = src.match(new RegExp(`<!-- BEGIN shared-${name} -->([\\s\\S]*?)<!-- END shared-${name} -->`));
  return m ? m[1] : null;
}

test("shared partials contain their key elements", () => {
  for (const id of ['class="site-header"', 'id="toggleMenu"', 'id="openCart"', 'id="categoryMenu"']) {
    assert.ok(headerPartial.includes(id), `header partial missing ${id}`);
  }
  assert.match(footerPartial, /class="site-footer"/);
  assert.match(footerPartial, /class="footer-brand"/);
  for (const link of FOOTER_LINKS) {
    assert.ok(footerPartial.includes(`href="${link}"`), `footer partial missing link ${link}`);
  }
});

test("homepage header/footer are synced from the partials (not hand-diverged)", () => {
  const h = region(indexHtml, "header");
  const f = region(indexHtml, "footer");
  assert.ok(h && f, "index.html missing shared-header/footer markers");
  assert.ok(norm(h).includes(norm(headerPartial)), "homepage header diverged from partials/header.html");
  assert.ok(norm(f).includes(norm(footerPartial)), "homepage footer diverged from partials/footer.html");
});

test("product, landing and catalog pages embed the shared footer", () => {
  const samples = [productPages()[0]?.html, read("category/laundry/index.html"), read("catalog/index.html")];
  for (const html of samples) {
    assert.ok(html, "missing a sample page");
    assert.match(html, /class="site-header"/);
    assert.match(html, /class="site-footer"/);
    assert.match(html, /class="footer-brand"/);
    for (const link of FOOTER_LINKS) {
      assert.ok(html.includes(`href="${link}"`), `page footer missing link ${link}`);
    }
  }
});

test("every product page has the consistent action set", () => {
  const pages = productPages();
  assert.ok(pages.length >= 50);
  const checks = {
    back: (h) => h.includes("data-back"),
    favorite: (h) => h.includes("data-favorite"),
    share: (h) => h.includes("data-share"),
    "whatsapp-question": (h) => h.includes("Спросить в WhatsApp"),
    "cart-or-oos": (h) => h.includes("data-add-cart") || h.includes("Нет в наличии"),
  };
  for (const [name, fn] of Object.entries(checks)) {
    const bad = pages.filter((p) => !fn(p.html)).map((p) => p.slug);
    assert.deepEqual(bad, [], `product pages missing ${name}: ${bad.slice(0, 5).join(", ")}`);
  }
});

test("footer with logo + catalog/checkout/policy on home and product pages", () => {
  const targets = [indexHtml, ...productPages().map((p) => p.html)];
  for (const html of targets) {
    assert.match(html, /class="footer-brand"/);
    for (const link of FOOTER_LINKS) {
      assert.ok(html.includes(`href="${link}"`), `footer link ${link} missing`);
    }
  }
});
