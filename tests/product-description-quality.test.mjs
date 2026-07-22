import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/public-catalog.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/product-pages.json"), "utf8"));

const curatedProductIds = [
  "prd_08eb2cef1689", "prd_77e4cc05435f", "prd_1f9a545036b2",
  "prd_b0bf34e30459", "prd_c5f3a1dce862", "prd_9df7a08005ce",
  "prd_894a7f6437d0", "prd_4b7604e36f02", "prd_f19e014e94cf",
  "prd_9174d6118ed3", "prd_f0d3a0b9698b", "prd_e7e45d64df8b",
  "prd_d8023f79398b", "prd_2563a902d211", "prd_311be4dd4930",
  "prd_45a4eda764f6", "prd_477c3cbc2534", "prd_1710ac102a49",
  "prd_0fb16d2a0b60", "prd_594869df277e", "prd_3e6fdfc928fc",
  "prd_96f0268a48e0", "prd_40d21a2a86d6", "prd_3fd39e5d8314",
  "prd_165eafb70eb3", "prd_e993df33c857", "prd_6d023c2652c2",
  "prd_83037f3d35df", "prd_06e5daf553c4", "prd_0e763c9c3654",
];

const productsById = new Map(catalog.products.map((product) => [product.id, product]));
const pagesById = new Map(manifest.pages.map((page) => [page.id, page]));
const forbiddenPublicPhrases = [
  "штрихкод:",
  "товар для дома и личного ухода",
  "наличие и детали заказа подтвердит менеджер",
];

test("curated product descriptions remain useful and public", () => {
  assert.equal(curatedProductIds.length, 30);
  for (const productId of curatedProductIds) {
    const product = productsById.get(productId);
    assert.ok(product, `${productId}: missing from public catalog`);
    const description = product.description.trim();
    const sentences = description.match(/[.!?](?:\s|$)/g) || [];
    assert.ok(description.length >= 150, `${productId}: description is too short`);
    assert.ok(sentences.length >= 2 && sentences.length <= 4, `${productId}: expected 2-4 sentences`);
    for (const phrase of forbiddenPublicPhrases) {
      assert.ok(!description.toLowerCase().includes(phrase), `${productId}: contains placeholder/internal phrase`);
    }

    const page = pagesById.get(productId);
    assert.ok(page, `${productId}: missing generated product page`);
    const html = fs.readFileSync(path.join(root, page.path, "index.html"), "utf8");
    assert.ok(html.includes('<p class="description">'), `${productId}: description block missing`);
    assert.ok(
      html.includes("body.product-page .product-detail-info .description { display: block;"),
      `${productId}: mobile description visibility override missing`,
    );
    assert.ok(html.includes(description.replaceAll("&", "&amp;")), `${productId}: generated page has stale description`);
  }
});
