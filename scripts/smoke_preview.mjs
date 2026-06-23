#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const defaultBaseUrl = "https://shared-layout-preview.globalmarket-kg.pages.dev";
const defaultProductPath = "/product/dalli-colorwaschmittel-gel-dlya-stirki-1-1-l-bdb383/";

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    const runtimeDir = process.env.PLAYWRIGHT_RUNTIME_DIR;
    if (!runtimeDir) throw error;
    const require = createRequire(path.join(runtimeDir, "runtime.cjs"));
    return require("playwright");
  }
}

function browserLaunchOptions() {
  const options = { headless: true };
  const explicit = process.env.PLAYWRIGHT_CHROME_PATH;
  const chromeCandidates = [
    explicit,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);
  const executablePath = chromeCandidates.find((item) => fs.existsSync(item));
  if (executablePath) options.executablePath = executablePath;
  return options;
}

function reportLine(lines, status, message) {
  lines.push(`- ${status}: ${message}`);
}

async function count(page, selector) {
  return page.locator(selector).count();
}

async function expectAtLeast(page, selector, min, label, errors, lines) {
  const value = await count(page, selector);
  if (value < min) {
    const message = `${label}: expected at least ${min}, got ${value}`;
    errors.push(message);
    reportLine(lines, "FAIL", message);
  } else {
    reportLine(lines, "OK", `${label}: ${value}`);
  }
}

async function expectVisible(page, selector, label, errors, lines) {
  const visible = await page.locator(selector).first().isVisible().catch(() => false);
  if (!visible) {
    const message = `${label}: not visible`;
    errors.push(message);
    reportLine(lines, "FAIL", message);
  } else {
    reportLine(lines, "OK", `${label}: visible`);
  }
}

async function checkHeader(page, label, errors, lines) {
  const box = await page.locator(".site-header").boundingBox();
  if (!box) {
    const message = `${label}: header missing`;
    errors.push(message);
    reportLine(lines, "FAIL", message);
    return;
  }
  const maxHeight = label.includes("desktop") ? 90 : 78;
  if (box.height > maxHeight) {
    const message = `${label}: header too tall (${Math.round(box.height)}px > ${maxHeight}px)`;
    errors.push(message);
    reportLine(lines, "FAIL", message);
  } else {
    reportLine(lines, "OK", `${label}: header height ${Math.round(box.height)}px`);
  }
}

async function smokeHome(page, baseUrl, viewportLabel, errors, lines) {
  await page.goto(`${baseUrl}/?smoke=${Date.now()}#top`, { waitUntil: "networkidle" });
  await expectVisible(page, ".site-header", `${viewportLabel} homepage header`, errors, lines);
  await checkHeader(page, `${viewportLabel} homepage`, errors, lines);
  await expectAtLeast(page, ".hero-slide", 1, `${viewportLabel} hero slides`, errors, lines);
  await expectAtLeast(page, ".quick-category", 12, `${viewportLabel} quick categories`, errors, lines);
  await expectAtLeast(page, ".product-card", 8, `${viewportLabel} product cards`, errors, lines);

  await page.locator("#toggleMenu").click();
  await expectAtLeast(page, "#categoryMenu a, #categoryMenu button", 6, `${viewportLabel} menu items`, errors, lines);
  await page.keyboard.press("Escape").catch(() => {});

  await page.locator("#openCart").click();
  await expectVisible(page, "#cartDrawer.open", `${viewportLabel} cart drawer`, errors, lines);
  await expectVisible(page, "#checkoutLink", `${viewportLabel} checkout link`, errors, lines);
}

async function smokeProduct(page, baseUrl, productPath, viewportLabel, errors, lines) {
  await page.goto(`${baseUrl}${productPath}`, { waitUntil: "networkidle" });
  await expectVisible(page, ".site-header", `${viewportLabel} product header`, errors, lines);
  await checkHeader(page, `${viewportLabel} product`, errors, lines);
  await expectVisible(page, ".media-main", `${viewportLabel} product main image`, errors, lines);
  await expectAtLeast(page, ".gallery-thumb", 2, `${viewportLabel} gallery thumbs`, errors, lines);
  await expectVisible(page, "[data-favorite]", `${viewportLabel} favorite action`, errors, lines);
  await expectVisible(page, "[data-share]", `${viewportLabel} share action`, errors, lines);
  await expectVisible(page, "[data-add-cart]", `${viewportLabel} add to cart`, errors, lines);
  await expectAtLeast(page, ".related-card", 4, `${viewportLabel} related products`, errors, lines);

  const before = await page.locator("[data-cart-count]").first().textContent();
  await page.locator("[data-add-cart]").click();
  await page.waitForTimeout(350);
  const after = await page.locator("[data-cart-count]").first().textContent();
  if (String(before).trim() === String(after).trim()) {
    const message = `${viewportLabel} product add-to-cart did not update header count`;
    errors.push(message);
    reportLine(lines, "FAIL", message);
  } else {
    reportLine(lines, "OK", `${viewportLabel} product add-to-cart updates header count`);
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(argValue("--base-url", defaultBaseUrl));
  const productPath = argValue("--product-path", defaultProductPath);
  const reportPath = path.resolve(root, argValue("--report", "outputs/browser-smoke-report.md"));
  const errors = [];
  const lines = [
    "# Browser Smoke Report",
    "",
    `Base URL: ${baseUrl}`,
    `Product path: ${productPath}`,
    `Generated at: ${new Date().toISOString()}`,
    "",
  ];

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch(browserLaunchOptions());
  try {
    for (const viewport of [
      { label: "mobile", width: 390, height: 844 },
      { label: "desktop", width: 1366, height: 900 },
    ]) {
      lines.push(`## ${viewport.label}`);
      lines.push("");
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      page.on("pageerror", (error) => {
        const message = `${viewport.label} JS error: ${error.message}`;
        errors.push(message);
        reportLine(lines, "FAIL", message);
      });
      page.on("console", (message) => {
        if (message.type() === "error") {
          const text = message.text();
          if (!/favicon|Failed to load resource/i.test(text)) {
            const errorMessage = `${viewport.label} console error: ${text}`;
            errors.push(errorMessage);
            reportLine(lines, "FAIL", errorMessage);
          }
        }
      });
      await smokeHome(page, baseUrl, viewport.label, errors, lines);
      await smokeProduct(page, baseUrl, productPath, viewport.label, errors, lines);
      await page.close();
      lines.push("");
    }
  } finally {
    await browser.close();
  }

  lines.push(`Errors: ${errors.length}`);
  lines.push("");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Browser smoke report: ${reportPath}`);
  if (errors.length) {
    console.error("Browser smoke failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("Browser smoke OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
