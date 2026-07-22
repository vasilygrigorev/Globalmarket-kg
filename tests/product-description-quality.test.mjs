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
  "prd_cbc7943d5965", "prd_0fffb16fcaee", "prd_f5192ea22a74",
  "prd_d0f02fd7d3b0", "prd_20736a33272d", "prd_19a727030e6b",
  "prd_56516b8b34c7", "prd_c980a01a8dba", "prd_6280c4c29502",
  "prd_b2586efc6925", "prd_6ac15f7b2cff", "prd_94f09d0e25fc",
  "prd_9499434568a7", "prd_ebd75b1e7557", "prd_081404d81ef8",
  "prd_ded7b0409c9c", "prd_bd8fab362271", "prd_e165f2a765a7",
  "prd_a9ee2b0ab49d", "prd_f724e0973fa5", "prd_5c4dde48386b",
  "prd_fc72d049dab9", "prd_26f86cee34e8", "prd_2acd534839ea",
  "prd_0d95e9b49711", "prd_b8b5bfec07e5", "prd_cc0deb97f256",
  "prd_79ae12d5e324", "prd_8b3a9f34a763", "prd_096618ced7c1",
  "prd_d0bc9026f5ab", "prd_1e0cb301d44d", "prd_5faaff6cf17c",
  "prd_572ed90689d1", "prd_dce1df68b778", "prd_da9eaa7d3675",
  "prd_682eb8c7e746", "prd_fd5eee161942", "prd_733c019c32a5",
  "prd_1f1557a2acbb", "prd_296bd01a7c1f", "prd_160ca842c98e",
  "prd_a4eb0f5d79c1", "prd_77afdc5c4601", "prd_65a3b809cec1",
  "prd_4a753298e318", "prd_b05450ca161f", "prd_47adee9fbe47",
  "prd_01077bb33667", "prd_b1d27dff5c3e", "prd_8f967f2becb0",
  "prd_f50077a08461", "prd_45b58a935040", "prd_0b8a7c8dea63",
  "prd_96fe6b1c7d9c", "prd_77566889af78", "prd_09feb137fd5e",
  "prd_b61ba7c4268e", "prd_1cb756e99bac", "prd_66dd4882eecf",
  "prd_773d5cd63456", "prd_bca38e1fa11e", "prd_f3ed12b53668",
  "prd_56cefec24fdf", "prd_7c7e94c7128f", "prd_e40df5ac7d15",
  "prd_f7a9d836005f", "prd_47c8b6565a63", "prd_9bb309942383",
  "prd_168ccd5d1f3e", "prd_21c8c8aa3e5d", "prd_debb27afb337",
  "prd_7f5f15b91773", "prd_be5c87ae6741", "prd_9f1a9f037659",
  "prd_1b7d37e71949", "prd_bd1e6c3316c4", "prd_76659cd2bb07",
  "prd_f83cc0014f92", "prd_d89548b02b08", "prd_a5a45ddea545",
  "prd_9e4624cbe2cf", "prd_6a96d3de0c5a", "prd_4f3caf82472d",
  "prd_08168d08df30", "prd_b26c0045dd47", "prd_13dbf4e592aa",
  "prd_4db8a0f93b3f", "prd_ac041a61a578", "prd_33a2990e3c6a",
  "prd_f027d150c31a", "prd_7ac05b86dfd8", "prd_6c3fa744cf67",
  "prd_48a2b18d3de6", "prd_539a47bdb383", "prd_d53b7b8bf384",
  "prd_bf0dc63d18a6", "prd_fbc4a5e759ac",
  "prd_70c1f5d616a6",
];

const productsById = new Map(catalog.products.map((product) => [product.id, product]));
const pagesById = new Map(manifest.pages.map((page) => [page.id, page]));
const forbiddenPublicPhrases = [
  "штрихкод:",
  "товар для дома и личного ухода",
  "наличие и детали заказа подтвердит менеджер",
];

test("curated product descriptions remain useful and public", () => {
  assert.equal(curatedProductIds.length, 129);
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
