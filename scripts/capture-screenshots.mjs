import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:4173/crypto-radar/";
const out = process.env.OUT ?? "docs/screenshots";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  proxy: { server: process.env.PROXY ?? "http://127.0.0.1:7897", bypass: "localhost,127.0.0.1" },
});

async function shot(name, path, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "zh-CN",
  });
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=\"market-row\"]", { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(options.wait ?? 6000);
  await page.screenshot({ path: out + "/" + name + ".png", fullPage: false });
  console.log("saved", name);
  await context.close();
}

await shot("overview", "");
await shot("spot", "spot");
await shot("futures", "perp");
await shot("alpha", "alpha");
await shot("screener", "screener");
await shot("watchlists", "watchlists");

// chart page needs a click on the first row
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "zh-CN" });
const page = await context.newPage();
await page.goto(base + "spot", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid=\"market-row\"]", { timeout: 120000 });
await page.waitForTimeout(2500);
await page.getByTestId("market-row").first().click();
await page.waitForSelector("[data-testid=\"price-chart\"]", { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(6000);
await page.screenshot({ path: out + "/chart.png" });
console.log("saved chart");
await context.close();

// mobile screenshot
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "zh-CN" });
const mpage = await mobile.newPage();
await mpage.goto(base + "spot", { waitUntil: "domcontentloaded" });
await mpage.waitForSelector("[data-testid=\"market-row\"]", { timeout: 120000 }).catch(() => {});
await mpage.waitForTimeout(5000);
await mpage.screenshot({ path: out + "/mobile.png" });
console.log("saved mobile");
await mobile.close();

await browser.close();
