/**
 * Verifies the deployed GitHub Pages site against the live Binance API.
 *
 * Usage:
 *   BASE=https://iiiiiiiiiiiiiKK.github.io/crypto-radar/ \
 *   PROXY=http://127.0.0.1:7897 node scripts/verify-live.mjs
 *
 * The proxy is only needed when the machine cannot reach Binance directly.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.BASE ?? "https://iiiiiiiiiiiiiKK.github.io/crypto-radar/";
const proxy = process.env.PROXY ?? "";
const out = process.env.OUT ?? "live-verification.txt";

const lines = [];
const browser = await chromium.launch({
  channel: "chrome",
  proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1" } : undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on("pageerror", (error) => consoleErrors.push("pageerror: " + error.message.slice(0, 160)));
page.on("console", (message) => {
  if (message.type() === "error" && !/Failed to load resource|404/.test(message.text())) {
    consoleErrors.push(message.text().slice(0, 160));
  }
});

async function probe(path, label) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await page.waitForTimeout(5000);
    const rows = await page.getByTestId("market-row").count();
    if (rows > 0) {
      const first = (await page.getByTestId("market-row").first().innerText()).replace(/\n/g, " | ");
      const badge = await page.getByTestId("connection-badge").getAttribute("data-state").catch(() => "n/a");
      lines.push(`${label}: rows=${rows} badge=${badge}`);
      lines.push("   " + first);
      return true;
    }
  }
  lines.push(`${label}: NO ROWS :: ` + (await page.locator("main").innerText().catch(() => "")).replace(/\n/g, " | ").slice(0, 190));
  return false;
}

await probe("", "OVERVIEW");
await probe("spot", "SPOT");
await probe("perp", "PERPETUAL");
await probe("alpha", "ALPHA");

// The screener scans every market at once.
await page.goto(base + "screener", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(15000);
await page.getByTestId("template-gainers").click();
await page.waitForTimeout(4000);
const hits = await page.getByTestId("screener-row").count();
lines.push(`SCREENER hits=${hits}`);
if (hits > 0) {
  lines.push("   " + (await page.getByTestId("screener-row").first().innerText()).replace(/\n/g, " | "));
}

// The chart draws real candles.
await page.goto(base + "spot", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid=\"market-row\"]", { timeout: 120000 });
await page.waitForTimeout(2500);
await page.getByTestId("market-row").first().click();
await page.waitForTimeout(12000);
lines.push(
  `CHART symbol=${await page.getByTestId("chart-symbol").innerText().catch(() => "n/a")} ` +
    `price=${await page.getByTestId("chart-price").innerText().catch(() => "n/a")} ` +
    `canvas=${await page.getByTestId("price-chart").count()}`,
);

lines.push("CONSOLE ERRORS: " + (consoleErrors.length ? consoleErrors.join(" ; ") : "none"));

await writeFile(out, lines.join("\n"));
await mkdir("docs", { recursive: true });
console.log(lines.join("\n"));
await browser.close();
