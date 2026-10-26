import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:4173/crypto-radar/";
const out = "docs/screenshots";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", proxy: { server: "http://127.0.0.1:7897", bypass: "localhost,127.0.0.1" } });

async function shot(name, path, viewport = { width: 1440, height: 900 }, wait = 7000, isMobile = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: "zh-CN", isMobile, hasTouch: isMobile });
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=\"market-row\"]", { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.screenshot({ path: out + "/" + name + ".png" });
  console.log("saved", name);
  await context.close();
}

await shot("overview", "");
await shot("spot", "spot");
await shot("futures", "perp");
await shot("alpha", "alpha");
await shot("screener", "screener");
await shot("watchlists", "watchlists");
await shot("mobile", "spot", { width: 390, height: 844 }, 7000, true);

const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "zh-CN" });
const page = await context.newPage();
await page.goto(base + "spot", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid=\"market-row\"]", { timeout: 120000 });
await page.waitForTimeout(2500);
await page.getByTestId("market-row").first().click();
await page.waitForSelector("[data-testid=\"price-chart\"]", { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(8000);
await page.screenshot({ path: out + "/chart.png" });
console.log("saved chart");
await context.close();

await browser.close();
