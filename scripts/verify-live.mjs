import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const base = "https://iiiiiiiiiiiiiKK.github.io/crypto-radar/";
const lines = [];

const browser = await chromium.launch({ channel: "chrome", proxy: { server: "http://127.0.0.1:7897", bypass: "localhost,127.0.0.1" } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function probe(path, label) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 16; i += 1) {
    await page.waitForTimeout(5000);
    const rows = await page.locator("[data-testid=\"market-row\"]").count();
    if (rows > 0) {
      const first = (await page.locator("[data-testid=\"market-row\"]").first().innerText()).replace(/\n/g, " | ");
      const badge = await page.getByTestId("connection-badge").getAttribute("data-state").catch(() => "n/a");
      lines.push(label + ": rows=" + rows + " badge=" + badge + " t=" + ((i + 1) * 5) + "s");
      lines.push("   " + first);
      return true;
    }
  }
  lines.push(label + ": NO ROWS :: " + (await page.locator("main").innerText().catch(() => "")).replace(/\n/g, " | ").slice(0, 190));
  return false;
}

await probe("", "LIVE OVERVIEW");
await probe("perp", "LIVE PERP");
await probe("alpha", "LIVE ALPHA");

writeFileSync(process.env.OUT ?? "live.txt", lines.join("\n"));
console.log(lines.join("\n"));
await browser.close();
