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
// Header nav links must be absolute (leading "/") — a bare "#top" would only
// scroll within the current page instead of navigating home when clicked from
// a nested page like /product/<slug>/ or /category/<slug>/.
const HEADER_LINKS = ["/#top", "/#catalog", "/#delivery", "/#checkout"];

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

test("header partial's home/catalog/delivery/checkout links are absolute, not bare fragments", () => {
  for (const link of HEADER_LINKS) {
    assert.ok(headerPartial.includes(`href="${link}"`), `header partial missing absolute link ${link}`);
  }
  // Catches a regression like href="#top" that would silently break "go home"
  // navigation from any page nested under /product/, /category/, /catalog/.
  const bareFragment = headerPartial.match(/href="#(top|catalog|delivery|checkout)"/);
  assert.equal(bareFragment, null, `header partial has a relative fragment link that breaks nested-page navigation: ${bareFragment && bareFragment[0]}`);
});

test("product/category/catalog pages carry the same absolute header links (home is always reachable)", () => {
  const samples = [
    ["product page", productPages()[0]?.html],
    ["category page", read("category/laundry/index.html")],
    ["catalog page", read("catalog/index.html")],
  ];
  for (const [label, html] of samples) {
    assert.ok(html, `missing sample: ${label}`);
    for (const link of HEADER_LINKS) {
      assert.ok(html.includes(`href="${link}"`), `${label} missing absolute header link ${link}`);
    }
  }
});

test("the data-back button falls back to an absolute catalog path when there is no history", () => {
  const gen = read("scripts/generate_product_pages.py");
  assert.match(gen, /if \(history\.length > 1\) history\.back\(\);/);
  assert.match(gen, /window\.location\.href = "\/#catalog";/);
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

test("privacy page is a published policy rather than a draft", () => {
  const html = read("privacy.html");
  assert.doesNotMatch(html, /черновик/i);
  assert.match(html, /Какие данные мы получаем/);
  assert.match(html, /Для чего используются данные/);
  assert.match(html, /Права клиента/);
  assert.match(html, /globaldistkg@gmail\.com/);
  assert.match(html, /\+996 706 771 103/);
});

test("mobile product header reserves stable space below search", () => {
  const css = read("styles.css");
  assert.match(css, /body\.product-page\s*\{\s*--site-header-height:\s*107px;/s);
  assert.match(css, /body\.product-page \.site-header\s*\{[^}]*padding-bottom:\s*8px;/s);
});
