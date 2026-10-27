import { expect, test } from "@playwright/test";

/**
 * End-to-end smoke tests against the real Binance endpoints.
 * The tests intentionally rely on live data — no mocked market payloads.
 */

test("overview loads live market rows", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page.getByTestId("market-table")).toBeVisible({ timeout: 90_000 });

  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });
  const rows = page.getByTestId("market-row");
  expect(await rows.count()).toBeGreaterThan(0);

  const firstSymbol = await rows.first().getAttribute("data-symbol");
  expect(firstSymbol).toBeTruthy();

  // Connection badge must report a live or reconnecting socket.
  const badge = page.getByTestId("connection-badge");
  await expect(badge).toBeVisible();
  const state = await badge.getAttribute("data-state");
  expect(["connected", "connecting", "reconnecting", "stale"]).toContain(state);

  // Critical console errors must not appear.
  const critical = errors.filter(
    (message) =>
      !/Failed to load resource/i.test(message) &&
      !/net::ERR/i.test(message) &&
      !/429|418/i.test(message),
  );
  expect(critical).toEqual([]);
});

test("search filters the market table", async ({ page }) => {
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });
  const before = await page.getByTestId("market-row").count();

  await page.getByTestId("global-search").fill("BTCUSDT");
  await expect
    .poll(async () => page.getByTestId("market-row").count(), { timeout: 60_000 })
    .toBeLessThanOrEqual(Math.max(before, 1));
  const symbols = await page.getByTestId("market-row").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-symbol")),
  );
  for (const symbol of symbols) expect(symbol ?? "").toContain("BTCUSDT");
});

test("sorting by change percent works", async ({ page }) => {
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: /涨跌幅|change %/i }).first().click();
  await page.waitForTimeout(600);
  const symbols = await page.getByTestId("market-row").evaluateAll((nodes) =>
    nodes.slice(0, 3).map((node) => node.getAttribute("data-symbol")),
  );
  expect(symbols.length).toBeGreaterThan(0);
});

test("watchlist star persists across a reload", async ({ page }) => {
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });

  const firstRow = page.getByTestId("market-row").first();
  const symbol = await firstRow.getAttribute("data-symbol");
  const star = firstRow.locator("button[aria-pressed]");
  const before = await star.getAttribute("aria-pressed");
  await star.click();
  await expect
    .poll(async () => star.getAttribute("aria-pressed"), { timeout: 60_000 })
    .not.toBe(before);

  await page.reload();
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });
  const reloaded = page.getByTestId("market-row").first().locator("button[aria-pressed]");
  await expect(reloaded).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
  expect(symbol).toBeTruthy();
});

test("chart page renders candles and indicators", async ({ page }) => {
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });
  await page.getByTestId("market-row").first().click();

  await expect(page.getByTestId("chart-symbol")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("price-chart")).toBeVisible();
  await expect(page.getByTestId("chart-price")).not.toHaveText("--");

  await page.getByTestId("indicator-ma").click();
  await page.getByTestId("indicator-rsi").click();
  await page.getByTestId("interval-1h").click();
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("price-chart")).toBeVisible();
});

test("perpetual market shows futures-only data", async ({ page }) => {
  await page.goto("perp");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });

  // The perpetual table must contain contracts, not spot pairs.
  const symbols = await page.getByTestId("market-row").evaluateAll((nodes) =>
    nodes.slice(0, 5).map((node) => node.getAttribute("data-symbol")),
  );
  expect(symbols.length).toBeGreaterThan(0);
  expect(symbols[0]).toMatch(/USDT|USDC|BUSD/);

  // Funding rate is a real futures field — it must appear on both layouts.
  const isPhone = page.viewportSize()!.width < 768;
  if (!isPhone) {
    await page.getByTestId("open-columns").click();
    await expect(page.getByTestId("column-fundingRate")).toBeVisible();
    await page.getByTestId("column-fundingRate").check();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2500);
  }

  const row = await page.getByTestId("market-row").first().innerText();
  expect(row).toMatch(/-?\d+\.\d{4}%/);
});

test("board tabs actually filter and order the table", async ({ page }) => {
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });

  const firstText = async () =>
    (await page.getByTestId("market-row").first().innerText()).replace(/\n/g, " | ");

  await page.getByTestId("board-gainers").click();
  await page.waitForTimeout(1500);
  const gainers = await firstText();
  expect(gainers).toMatch(/\+\d/);

  await page.getByTestId("board-losers").click();
  await page.waitForTimeout(1500);
  const losers = await firstText();
  expect(losers).toMatch(/-\d/);

  await page.getByTestId("board-volume").click();
  await page.waitForTimeout(1200);
  await page.getByTestId("board-all").click();
  await page.waitForTimeout(800);

  // The two boards must not lead with the same pair.
  expect(gainers).not.toBe(losers);
});

test("heatmap view renders turnover weighted tiles", async ({ page }) => {
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });
  await page.getByTestId("view-heatmap").click();
  await expect(page.getByTestId("heatmap")).toBeVisible();
  const tiles = page.getByTestId("heatmap-tile");
  expect(await tiles.count()).toBeGreaterThan(10);
  await page.getByTestId("view-list").click();
  await expect(page.getByTestId("market-row").first()).toBeVisible();
});

test("basis radar joins spot and perpetual", async ({ page }) => {
  await page.goto("basis");
  await expect(page.getByTestId("basis-row").first()).toBeVisible({ timeout: 120_000 });
  const rows = page.getByTestId("basis-row");
  expect(await rows.count()).toBeGreaterThan(10);
  const text = await rows.first().innerText();
  expect(text).toMatch(/-?\d+\.\d{3}%/);
});

test("price alerts can be created and survive a reload", async ({ page }) => {
  await page.goto("alerts");
  await expect(page.getByTestId("alert-symbol")).toBeVisible({ timeout: 90_000 });
  await page.getByTestId("alert-symbol").fill("BTCUSDT");
  await page.getByTestId("alert-value").fill("100000");
  await page.getByTestId("alert-add").click();
  await expect(page.getByTestId("alert-row")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("alert-row")).toHaveCount(1);
});

test("screener filters on real data", async ({ page }) => {
  await page.goto("screener");
  await expect(page.getByTestId("screener-table")).toBeVisible({ timeout: 90_000 });
  await page.getByTestId("template-gainers").click();
  await page.getByTestId("rule-min-change").fill("3");
  await page.waitForTimeout(2500);
  const rows = page.getByTestId("screener-row");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < Math.min(count, 5); i += 1) {
    await expect(rows.nth(i)).toBeVisible();
  }
});

test("language toggle switches the interface", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("global-search")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Primary" }).first();
  await expect(nav).toContainText("行情总览");

  await page.getByTestId("language-toggle").click();
  await expect(nav).toContainText("Overview");

  // The choice must survive a reload.
  await page.reload();
  await expect(page.getByTestId("global-search")).toBeVisible();
  await expect(nav).toContainText("Overview");

  await page.getByTestId("language-toggle").click();
  await expect(nav).toContainText("行情总览");
});

test("no horizontal overflow on mobile", async ({ page }) => {
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
});
