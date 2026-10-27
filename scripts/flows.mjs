import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4174/crypto-radar";
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text().slice(0, 200));
});

const results = [];
const flow = async (name, fn) => {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, detail });
    console.log(`PASS ${name} (${Date.now() - started}ms)`, JSON.stringify(detail).slice(0, 300));
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, detail: String(error).slice(0, 300) });
    console.log(`FAIL ${name} :: ${String(error).split("\n")[0].slice(0, 220)}`);
  }
};

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="connection-pill"][data-state="live"]', { timeout: 40_000 });
await page.waitForTimeout(3000);

await flow("home-shows-live-data", async () => {
  const facts = await page.evaluate(() => ({
    mood: document.querySelector('[data-testid="mood-label"]')?.textContent ?? null,
    movers: document.querySelectorAll(".mover").length,
    tape: document.querySelectorAll(".tape__item").length,
    firstPrice: document.querySelector(".pulse__px")?.textContent ?? null,
    labels: [...document.querySelectorAll(".panel__title")].map((n) => n.textContent?.trim()),
  }));
  if (!facts.mood) throw new Error("mood label missing");
  if (facts.movers === 0) throw new Error("mover board empty");
  return facts;
});

await flow("search-sol-opens-chart", async () => {
  await page.click('[data-testid="global-search"]');
  await page.fill('[data-testid="global-search"]', "SOL");
  await page.waitForSelector(".search__row", { timeout: 8000 });
  const hits = await page.evaluate(() =>
    [...document.querySelectorAll(".search__sym")].slice(0, 3).map((n) => n.textContent),
  );
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/charts/, { timeout: 12_000 });
  await page.waitForSelector('[data-testid="chart-stack"]', { timeout: 20_000 });
  await page.waitForTimeout(4000);
  const detail = await page.evaluate(() => ({
    url: location.href,
    canvases: document.querySelectorAll(".chartpane canvas").length,
    symbol: document.querySelector(".chartbar__sym")?.textContent ?? null,
    price: document.querySelector(".chartbar__px")?.textContent ?? null,
    bars: document.querySelector(".panel__hint")?.textContent ?? null,
  }));
  if (detail.canvases < 1) throw new Error("no chart canvas rendered");
  return { hits, ...detail };
});

await flow("interval-switch-reloads-data", async () => {
  await page.click('.ivbar__btn:has-text("1h")');
  await page.waitForTimeout(3500);
  const detail = await page.evaluate(() => ({
    active: document.querySelector(".ivbar__btn[data-active='true']")?.textContent ?? null,
    hint: document.querySelector(".panel__hint")?.textContent ?? null,
    candles: document.querySelector(".chartpane canvas") ? true : false,
  }));
  if (detail.active?.trim() !== "1h") throw new Error(`interval did not switch: ${detail.active}`);
  return detail;
});

await flow("indicator-toggle", async () => {
  const rsiButton = page.locator("button.btn--sm", { hasText: /^RSI$/ }).first();
  const before = await rsiButton.getAttribute("aria-pressed");
  await rsiButton.click();
  await page.waitForTimeout(1500);
  const after = await rsiButton.getAttribute("aria-pressed");
  const display = await page.evaluate(() => {
    const pane = document.querySelectorAll(".chartpane--sub")[0];
    return pane ? getComputedStyle(pane).display : null;
  });
  if (before === after) throw new Error("aria-pressed did not change");
  return { before, after, display };
});

await flow("market-sort", async () => {
  await page.goto(`${BASE}/markets`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="market-row"]', { timeout: 30_000 });
  await page.waitForTimeout(2000);
  const read = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="market-row"]')]
        .slice(0, 3)
        .map((row) => row.getAttribute("data-symbol")),
    );
  const before = await read();
  await page.click('.mkt__th:has-text("24h%") button');
  await page.waitForTimeout(1500);
  const mid = await read();
  await page.click('.mkt__th:has-text("24h%") button');
  await page.waitForTimeout(1500);
  const after = await read();
  return { before, mid, after, changed: JSON.stringify(before) !== JSON.stringify(mid) };
});

await flow("switch-to-futures", async () => {
  await page.click('.seg__btn:has-text("永续")');
  await page.waitForTimeout(4000);
  const detail = await page.evaluate(() => ({
    headers: [...document.querySelectorAll(".mkt__th")].map((n) => n.textContent?.trim()),
    rows: document.querySelectorAll('[data-testid="market-row"]').length,
  }));
  if (!detail.headers.some((header) => header?.includes("资金费率"))) {
    throw new Error(`funding column missing: ${detail.headers.join(",")}`);
  }
  return detail;
});

await flow("switch-to-alpha", async () => {
  await page.click('.seg__btn:has-text("Alpha")');
  await page.waitForTimeout(6000);
  const detail = await page.evaluate(() => ({
    notice: document.querySelector(".notice")?.textContent?.slice(0, 60) ?? null,
    rows: document.querySelectorAll('[data-testid="market-row"]').length,
    headers: [...document.querySelectorAll(".mkt__th")].map((n) => n.textContent?.trim()),
  }));
  if (detail.headers.some((header) => header?.includes("资金费率"))) {
    throw new Error("alpha must not show perpetual columns");
  }
  return detail;
});

await flow("star-adds-watchlist", async () => {
  await page.click('.seg__btn:has-text("现货")');
  await page.waitForTimeout(3000);
  await page.hover('[data-testid="market-row"]');
  await page.click('[data-testid="market-row"] .star');
  await page.goto(`${BASE}/watchlist`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const rows = await page.evaluate(() => document.querySelectorAll('[data-testid="watch-row"]').length);
  if (rows === 0) throw new Error("watchlist row missing after starring");
  return { watchRows: rows };
});

await flow("radar-threshold-changes-results", async () => {
  await page.goto(`${BASE}/radar`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const before = await page.evaluate(() => ({
    rows: document.querySelectorAll(".results__row").length,
    evaluated: document.querySelector(".scanstat__v")?.textContent ?? null,
  }));
  await page.fill('.cond input[type="number"]', "0.01");
  await page.waitForTimeout(4000);
  const after = await page.evaluate(() => document.querySelectorAll(".results__row").length);
  if (Number(before.evaluated) === 0) throw new Error("scanner evaluated 0 rows");
  return { before, after };
});

await flow("radar-pause-resume", async () => {
  await page.click('button:has-text("暂停扫描")');
  await page.waitForTimeout(800);
  const paused = await page.evaluate(() => document.querySelector(".radar__banner-title")?.textContent ?? null);
  await page.click('button:has-text("继续扫描")');
  await page.waitForTimeout(800);
  const resumed = await page.evaluate(() => document.querySelector(".radar__banner-title")?.textContent ?? null);
  return { paused, resumed };
});

await flow("studio-exports-png", async () => {
  await page.goto(`${BASE}/studio`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const canvas = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="meme-canvas"]');
    return el ? { w: el.width, h: el.height } : null;
  });
  if (!canvas || canvas.w !== 1200) throw new Error(`canvas not rendered: ${JSON.stringify(canvas)}`);
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 25_000 }),
    page.click('button:has-text("导出 PNG")'),
  ]);
  const file = await download.path();
  const bytes = file ? fs.statSync(file).size : 0;
  if (bytes < 5000) throw new Error(`exported png too small: ${bytes}`);
  return { canvas, filename: download.suggestedFilename(), bytes };
});

await flow("studio-template-switch", async () => {
  await page.click('.tpl-card:has-text("崩了")');
  await page.waitForTimeout(1200);
  const active = await page.evaluate(
    () => document.querySelector(".tpl-card[data-active='true'] .tpl-card__name")?.textContent ?? null,
  );
  if (active !== "崩了") throw new Error(`template did not switch: ${active}`);
  return { active };
});

await flow("hotkey-r-opens-radar", async () => {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.keyboard.press("r");
  await page.waitForURL(/\/radar/, { timeout: 8000 });
  return page.url();
});

await flow("hotkey-ignored-inside-input", async () => {
  await page.click('[data-testid="global-search"]');
  await page.fill('[data-testid="global-search"]', "eth");
  await page.keyboard.press("r");
  await page.waitForTimeout(600);
  const detail = await page.evaluate(() => ({
    value: document.querySelector('[data-testid="global-search"]').value,
    url: location.pathname,
  }));
  if (detail.value !== "ethr") throw new Error(`typing inside the input triggered a shortcut: ${detail.value}`);
  return detail;
});

await flow("hotkey-help-modal", async () => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.keyboard.press("?");
  await page.waitForSelector(".modal", { timeout: 5000 });
  const title = await page.evaluate(() => document.querySelector(".modal__title")?.textContent ?? null);
  const rows = await page.evaluate(() => document.querySelectorAll(".hotkeys__row").length);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => document.querySelectorAll(".modal").length === 0);
  if (!closed) throw new Error("Escape did not close the modal");
  return { title, rows };
});

await flow("settings-persist-motion", async () => {
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.click('.seg__btn:has-text("减弱")');
  await page.waitForTimeout(500);
  const motion = await page.evaluate(() => document.documentElement.dataset.motion);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const afterReload = await page.evaluate(() => document.documentElement.dataset.motion);
  if (afterReload !== "calm") throw new Error(`preference not persisted: ${afterReload}`);
  // restore
  await page.click('.seg__btn:has-text("完整")');
  return { motion, afterReload };
});

await flow("mobile-layout-no-overflow", async () => {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
  });
  const mp = await mobile.newPage();
  const overflow = [];
  for (const route of ["/", "/markets", "/radar", "/charts", "/watchlist", "/studio"]) {
    await mp.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await mp.waitForTimeout(3000);
    const info = await mp.evaluate(() => {
      const railEl = document.querySelector(".rail");
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        bar: Boolean(document.querySelector(".mobilebar")),
        rail: railEl ? getComputedStyle(railEl).display : null,
      };
    });
    overflow.push({ route, ...info });
  }
  await mobile.close();
  const bad = overflow.filter((item) => item.overflow > 2);
  if (bad.length > 0) throw new Error(`horizontal overflow on ${JSON.stringify(bad)}`);
  return overflow;
});

await flow("watchlist-drag-reorder", async () => {
  // Star rows until the group holds at least two pairs (the earlier flow may
  // have starred one of them already, and starring toggles).
  await page.goto(`${BASE}/markets`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="market-row"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const rows = page.locator('[data-testid="market-row"]');
  for (let index = 0; index < 6; index += 1) {
    const count = await page.evaluate(() => Number(localStorage.getItem("crypto-radar:v2:watchlist")?.match(/"key"/g)?.length ?? 0));
    if (count >= 2) break;
    await rows.nth(index).hover();
    await rows.nth(index).locator(".star").click();
    await page.waitForTimeout(350);
  }
  await page.goto(`${BASE}/watchlist`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const readOrder = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="watch-row"]')].map((n) => n.getAttribute("data-symbol")),
    );
  const symbols = await readOrder();
  if (symbols.filter(Boolean).length < 2) throw new Error(`need two rows, got ${symbols.length}`);
  const reordered = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="watch-row"]')];
    const dataTransfer = new DataTransfer();
    rows[0].dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
    rows[1].dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
    rows[1].dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
    rows[0].dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
    return new Promise((resolve) =>
      setTimeout(
        () =>
          resolve(
            [...document.querySelectorAll('[data-testid="watch-row"]')].map((n) =>
              n.getAttribute("data-symbol"),
            ),
          ),
        500,
      ),
    );
  });
  if (JSON.stringify(symbols) === JSON.stringify(reordered)) {
    throw new Error(`order unchanged: ${symbols.join(",")}`);
  }
  return { before: symbols, after: reordered };
});

await flow("price-alert-fires-in-page", async () => {
  // A threshold far below any real price must fire on the next evaluation tick.
  await page.fill('input[inputmode="decimal"]', "0.00000001");
  await page.click('button.btn--primary:has-text("添加")');
  await page.waitForSelector(".toast", { timeout: 15_000 });
  const toast = await page.evaluate(() => document.querySelector(".toast")?.textContent ?? null);
  const alertRows = await page.evaluate(() => document.querySelectorAll(".alertrow").length);
  if (!toast || !toast.includes("触发")) throw new Error(`toast missing: ${toast}`);
  return { alertRows, toast: toast.replace(/\s+/g, " ").slice(0, 90) };
});

await flow("chart-loads-500-bars", async () => {
  await page.goto(`${BASE}/charts?market=spot&symbol=BTCUSDT`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="chart-stack"]', { timeout: 20_000 });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".panel__hint")].some((node) => /根$/.test(node.textContent ?? "")),
    { timeout: 25_000 },
  );
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const hints = [...document.querySelectorAll(".panel__hint")].map((n) => n.textContent?.trim());
    return {
      hints,
      canvases: document.querySelectorAll(".chartpane canvas").length,
      legend: document.querySelector(".chartpane__legend")?.textContent?.replace(/\s+/g, " ").trim(),
    };
  });
  const bars = info.hints.find((hint) => hint && /根$/.test(hint));
  if (!bars || !/(4[5-9]\d|500)\s*根/.test(bars)) throw new Error(`bars not loaded: ${JSON.stringify(info.hints)}`);
  return { bars, canvases: info.canvases, legend: info.legend };
});

await flow("author-x-link", async () => {
  const results = [];
  for (const route of ["/", "/markets", "/radar", "/charts", "/studio", "/watchlist", "/settings"]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const link = page.locator('[data-testid="author-x"]');
    await link.waitFor({ state: "visible", timeout: 8000 });
    const href = await link.getAttribute("href");
    const target = await link.getAttribute("target");
    const rel = await link.getAttribute("rel");
    const box = await link.boundingBox();
    if (href !== "https://x.com/0xkillcoin") throw new Error(`${route}: href=${href}`);
    if (target !== "_blank") throw new Error(`${route}: target=${target}`);
    if (!rel?.includes("noopener")) throw new Error(`${route}: rel=${rel}`);
    if (!box || box.height < 30) throw new Error(`${route}: hit area ${JSON.stringify(box)}`);
    results.push({ route, h: Math.round(box.height) });
  }
  return results.map((item) => `${item.route}:${item.h}px`).join(" ");
});

await flow("no-console-errors", async () => {
  if (errors.length > 0) throw new Error(errors.slice(0, 5).join(" | "));
  return "clean";
});

fs.writeFileSync("flows-report.json", JSON.stringify({ results, errors }, null, 2), "utf8");
await browser.close();
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} flows passed`);
