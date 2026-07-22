// Marketplace-style mobile bottom nav contract — no network, no browser.
// Guards the fixed bottom nav (Главная/Каталог/Избранное/Корзина/Кабинет) on
// both the homepage and every generated product page, plus the cabinet
// additions (compact orders and account forms) built for it.
// Run: node --test tests/mobile-bottom-nav.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const indexHtml = read("index.html");
const appJs = read("app.js");
const bottomNavPartial = read("partials/bottom-nav.html");
const productGen = read("scripts/generate_product_pages.py");

function navItems(html) {
  return [...html.matchAll(/class="bottom-nav-item"[^>]*id="(bottomNav\w+)"[^>]*data-bottom-nav="(\w+)"/g)].map((m) => ({
    id: m[1],
    action: m[2],
  }));
}

test("bottom nav exists on the homepage with exactly 5 items", () => {
  const items = navItems(indexHtml);
  assert.equal(items.length, 5, `expected 5 nav items, got ${items.length}`);
  assert.deepEqual(
    items.map((i) => i.action),
    ["home", "catalog", "favorites", "cart", "cabinet"],
  );
});

test("bottom nav partial matches what's embedded in index.html (single source of truth)", () => {
  assert.deepEqual(navItems(bottomNavPartial), navItems(indexHtml));
});

test("home nav icon is one coherent SVG instead of separately positioned roof pieces", () => {
  assert.match(bottomNavPartial, /bottom-nav-icon-home[\s\S]*?<svg viewBox="0 0 24 24"/);
  assert.match(bottomNavPartial, /<path d="m3 11 9-8 9 8"><\/path>/);
});

test("bottom nav is mobile-only (gated behind a max-width media query) and doesn't overlap content", () => {
  const css = read("styles.css");
  assert.match(css, /\.mobile-bottom-nav\s*\{[^}]*display:\s*none/s);
  assert.match(css, /@media[^{]*max-width[^{]*\{[\s\S]*\.mobile-bottom-nav\s*\{[^}]*display:\s*flex/);
  // Safe-area + fixed-nav clearance so content/footer isn't hidden under it.
  assert.match(css, /padding-bottom:\s*calc\(var\(--mobile-bottom-nav-height\)/);
});

test("cart nav item has a live badge wired to renderCart()", () => {
  assert.match(indexHtml, /id="bottomNavCartCount"/);
  assert.match(appJs, /bottomNavCartCount\.textContent = String\(totalCount\)/);
  assert.match(appJs, /bottomNavCartCount\.hidden = totalCount === 0/);
});

test("favorites nav item has a live badge wired to renderFavoriteFilter()", () => {
  assert.match(indexHtml, /id="bottomNavFavoritesCount"/);
  assert.match(appJs, /bottomNavFavoritesCount\.textContent = String\(count\)/);
});

test("catalog nav entry points at the real catalog section", () => {
  assert.match(indexHtml, /id="bottomNavCatalog" href="\/#catalog"/);
  assert.match(indexHtml, /id="catalog"/);
});

test("cabinet nav entry points at the real Мои заказы / личный кабинет section", () => {
  assert.match(indexHtml, /id="bottomNavCabinet" href="\/#myOrders"/);
  assert.match(indexHtml, /id="myOrders"/);
  assert.match(appJs, /window\.scrollY \+ cabinetSection\.getBoundingClientRect\(\)\.top/);
  assert.match(appJs, /window\.location\.hash === "#myOrders"/);
  assert.match(appJs, /const cabinetVisible = window\.scrollY >= cabinetTop - 80/);
});

test("bottom nav degrades to plain links (works from a product page, a different document, without app.js state)", () => {
  for (const href of ['href="/#top"', 'href="/#catalog"', 'href="/?favorites=1#catalog"', 'href="/?openCart=1#top"', 'href="/#myOrders"']) {
    assert.ok(indexHtml.includes(href), `bottom nav missing plain-link fallback: ${href}`);
  }
});

test("Избранное toggles (does not get stuck on) — tapping it again turns the filter off", () => {
  const fn = appJs.match(/bottomNavFavoritesLink\?\.addEventListener\("click"[\s\S]*?\n\}\);/)[0];
  assert.match(fn, /const enabling = !state\.favoriteOnly/);
  assert.match(fn, /state\.favoriteOnly = enabling/);
  // Enabling favorites clears any lingering category/collection/search so it
  // shows favorites across the whole catalog, not filtered to a leftover
  // category (the "Главная / Тело" + 0 товаров stuck state).
  assert.match(fn, /state\.category = "Все"/);
});

test("Каталог turns off a lingering favorites filter (never leaves the user stuck on an empty favorites list)", () => {
  const fn = appJs.match(/bottomNavCatalogLink\?\.addEventListener\("click"[\s\S]*?\n\}\);/)[0];
  assert.match(fn, /state\.favoriteOnly = false/);
});

test("selecting a category / collection / search query clears the favorites filter", () => {
  for (const fnName of ["selectCategory", "selectQuery", "selectCategoryQuery", "selectCollection", "selectCollectionQuery"]) {
    const fn = appJs.match(new RegExp(`function ${fnName}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`))[0];
    assert.match(fn, /state\.favoriteOnly = false/, `${fnName} must clear favoriteOnly`);
  }
  for (const handler of ["searchInput", "headerSearchInput"]) {
    const fn = appJs.match(new RegExp(`${handler}\\.addEventListener\\("input"[\\s\\S]*?\\n\\}\\);`))[0];
    assert.match(fn, /state\.favoriteOnly = false/, `${handler} input must clear favoriteOnly`);
  }
});

test("Главная / logo reset to a clean top-of-home view (not left at the fixed-header anchor offset)", () => {
  assert.match(appJs, /function goHomeTop/);
  const fn = appJs.match(/function goHomeTop\(event\) \{[\s\S]*?\n\}/)[0];
  assert.match(fn, /selectCategory\("Все"\)/); // clears category/query/collection/favorites
  assert.match(fn, /window\.scrollTo\(\{ top: 0/); // to the very top, not the #top anchor offset
  assert.match(appJs, /bottomNavHomeLink\?\.addEventListener\("click", goHomeTop\)/);
  assert.match(appJs, /\.brand, \.footer-brand[\s\S]*?goHomeTop/); // logo/footer brand too
});

test("URL params from the bottom nav are honored on load (?favorites=1, ?openCart=1)", () => {
  assert.match(appJs, /function applyBottomNavParamsFromUrl/);
  assert.match(appJs, /params\.get\("favorites"\) === "1"/);
  assert.match(appJs, /params\.get\("openCart"\) === "1"/);
});

test("every generated product page includes the bottom nav and its badge script", () => {
  assert.match(productGen, /BOTTOM_NAV_PARTIAL_PATH/);
  assert.match(productGen, /bottom_nav_partial/);
  assert.match(productGen, /updateBottomNavFavoritesCount/);
  assert.match(productGen, /bottomNavCartCount/);
});

test("cabinet contains profile, compact orders, wholesale and contact without duplicate favorites", () => {
  assert.ok(!indexHtml.includes('id="favoritesBlock"'));
  assert.ok(!indexHtml.includes('id="myOrdersFavorites"'));
  assert.ok(!appJs.includes("renderCabinetFavorites"));
  assert.match(indexHtml, /id="profileBlock"/);
  assert.match(indexHtml, /id="ordersBlock"/);
  assert.match(indexHtml, /Прошлые заказы/);
  assert.match(indexHtml, /id="myOrdersResults"/);
  assert.match(indexHtml, /id="wholesaleBlock"/);
  assert.match(indexHtml, /id="contactBlock"/);
  assert.match(read("styles.css"), /body\.home-page \.site-header,[\s\S]*?min-height:\s*107px;[\s\S]*?padding-bottom:\s*8px;/);
});

test("logged-in cabinet shows an empty-orders state with a link back to the catalog", () => {
  assert.match(appJs, /emptyState/);
  assert.match(appJs, /У вас пока нет заказов/);
  assert.match(appJs, /renderMyOrders\(orders, \{ emptyState: true \}\)/);
});

test("logged-out cabinet still shows a compact phone-login card", () => {
  assert.match(indexHtml, /id="cabinetLoginCard"/);
  assert.match(indexHtml, />Войти</);
  assert.match(indexHtml, /id="myOrdersLoginForm"/);
});

test("all product pages on disk actually contain the bottom nav (spot-check across the catalog, not just one page)", () => {
  const productDir = join(ROOT, "product");
  const slugs = readdirSync(productDir).filter((name) => !name.startsWith("."));
  assert.ok(slugs.length > 50, "expected many generated product pages");
  const sample = slugs.filter((_, index) => index % 23 === 0).slice(0, 12);
  for (const slug of sample) {
    const html = read(join("product", slug, "index.html"));
    assert.match(html, /id="mobileBottomNav"/, `${slug} missing bottom nav`);
    assert.equal(navItems(html).length, 5, `${slug} bottom nav item count mismatch`);
  }
});
