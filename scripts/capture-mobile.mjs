import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.env.BASE ?? "http://127.0.0.1:4173/crypto-radar/";
const out = "docs/screenshots";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", proxy: { server: "http://127.0.0.1:7897", bypass: "localhost,127.0.0.1" } });

const iPhone = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };

async function shot(name, path, viewport, wait = 7000) {
  const context = await browser.newContext({ viewport, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, deviceScaleFactor: viewport.deviceScaleFactor, locale: "zh-CN" });
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=\"market-row\"]", { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.screenshot({ path: out + "/" + name + ".png" });
  console.log("saved", name);
  await context.close();
}

await shot("mobile-spot", "spot", iPhone);
await shot("mobile-perp", "perp", iPhone);
await shot("mobile-alpha", "alpha", iPhone);
await shot("mobile-screener", "screener", iPhone);
await shot("mobile-watchlists", "watchlists", iPhone);
await shot("mobile-settings", "settings", iPhone);

// chart on mobile
const context = await browser.newContext({ viewport: iPhone, isMobile: true, hasTouch: true, deviceScaleFactor: 3, locale: "zh-CN" });
const page = await context.newPage();
await page.goto(base + "spot", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid=\"market-row\"]", { timeout: 120000 });
await page.waitForTimeout(2500);
await page.getByTestId("market-row").first().click();
await page.waitForSelector("[data-testid=\"price-chart\"]", { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(9000);
await page.screenshot({ path: out + "/mobile-chart.png" });
console.log("saved mobile-chart");
await context.close();

await browser.close();
