import { chromium } from "playwright";

const base = "https://iiiiiiiiiiiiiKK.github.io/crypto-radar/";
const browser = await chromium.launch({ channel: "chrome", proxy: { server: "http://127.0.0.1:7897", bypass: "localhost,127.0.0.1" } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|404/.test(m.text())) errors.push(m.text().slice(0, 160)); });

await page.goto(base + "perp", { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid=\"market-row\"]", { timeout: 120000 });
await page.waitForTimeout(8000);

// chart page for a perp pair
await page.getByTestId("market-row").first().click();
await page.waitForTimeout(12000);
const symbol = await page.getByTestId("chart-symbol").innerText().catch(() => "n/a");
const price = await page.getByTestId("chart-price").innerText().catch(() => "n/a");
const chart = await page.getByTestId("price-chart").count();
console.log("LIVE CHART:", symbol, "|", price, "| chart=" + chart);

// screener with a real threshold
await page.goto(base + "screener", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
await page.getByTestId("template-gainers").click();
await page.getByTestId("rule-min-change").fill("2");
await page.waitForTimeout(3000);
const hits = await page.getByTestId("screener-row").count();
console.log("LIVE SCREENER hits:", hits);
if (hits > 0) console.log("  first:", (await page.getByTestId("screener-row").first().innerText()).replace(/\n/g, " | "));

console.log("ERRORS:", errors.length ? errors.join(" ; ") : "none");
await browser.close();
