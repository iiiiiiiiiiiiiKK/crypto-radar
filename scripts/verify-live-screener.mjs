import { chromium } from "playwright";

const base = process.env.BASE ?? "http://127.0.0.1:4173/crypto-radar/";
const browser = await chromium.launch({ channel: "chrome", proxy: { server: "http://127.0.0.1:7897", bypass: "localhost,127.0.0.1" } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(base + "screener", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(12000);

for (const tpl of ["gainers", "losers", "volume", "spike"]) {
  await page.getByTestId("template-" + tpl).click();
  await page.waitForTimeout(3000);
  const hits = await page.getByTestId("screener-row").count();
  const main = (await page.locator("main").innerText()).replace(/\n/g, " | ");
  console.log(tpl, "hits=" + hits, "::", main.slice(0, 170));
}

await browser.close();
