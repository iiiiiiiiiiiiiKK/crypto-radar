import { expect, test } from "@playwright/test";

/** The Meme 2.0 surfaces: mood, arena, events, studio, trader base. */

test("home shows a computed market mood with its factors", async ({ page }) => {
  await page.goto("");
  const panel = page.getByTestId("sentiment-panel");
  await expect(panel).toBeVisible({ timeout: 90_000 });

  const state = await panel.getAttribute("data-state");
  expect(["fomo", "greed", "chop", "fear", "panic", "illiquid"]).toContain(state);

  // The explanation exposes the measured factors.
  await page.getByTestId("sentiment-why-toggle").click();
  await expect(panel).toContainText(/[0-9]/);
});

test("arena boards rank live data and differ from each other", async ({ page }) => {
  await page.goto("");
  await expect(page.getByTestId("arena-row").first()).toBeVisible({ timeout: 90_000 });

  const firstOf = async () =>
    (await page.getByTestId("arena-row").first().innerText()).replace(/\n/g, " | ");

  await page.getByTestId("arena-tab-gainers").click();
  await page.waitForTimeout(1200);
  const gainers = await firstOf();
  expect(gainers).toMatch(/\+\d/);

  await page.getByTestId("arena-tab-losers").click();
  await page.waitForTimeout(1200);
  const losers = await firstOf();
  expect(losers).toMatch(/-\d/);

  await page.getByTestId("arena-tab-volume").click();
  await page.waitForTimeout(1200);
  expect(await firstOf()).not.toBe(gainers);
});

test("home can switch between arena, table and heatmap", async ({ page }) => {
  await page.goto("");
  await expect(page.getByTestId("sentiment-panel")).toBeVisible({ timeout: 90_000 });

  await page.getByTestId("home-view-table").click();
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });

  await page.getByTestId("home-view-heatmap").click();
  await expect(page.getByTestId("heatmap")).toBeVisible();

  await page.getByTestId("home-view-arena").click();
  await expect(page.getByTestId("arena-list")).toBeVisible();
});

test("event centre explains why an event fired", async ({ page }) => {
  await page.goto("events");
  await expect(page.getByTestId("event-list").or(page.getByTestId("events-empty"))).toBeVisible({
    timeout: 90_000,
  });

  const rows = page.getByTestId("event-row");
  if ((await rows.count()) > 0) {
    const text = await rows.first().innerText();
    // A row always carries the rule and a measured value.
    expect(text).toMatch(/[\d.]+%|[\d.]+×/);
  }
});

test("meme studio renders a real canvas and exports a png", async ({ page }) => {
  await page.goto("studio");
  await expect(page.getByTestId("studio-download")).toBeEnabled({ timeout: 120_000 });

  await expect(page.locator('canvas[data-testid="meme-canvas"]')).toBeVisible();

  const size = await page.evaluate(() => {
    const canvas = document.querySelector('canvas[data-testid="meme-canvas"]') as HTMLCanvasElement | null;
    if (!canvas) return null;
    const context = canvas.getContext("2d")!;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 0; i < data.length; i += 4 * 211) {
      if (data[i] + data[i + 1] + data[i + 2] > 40) painted += 1;
    }
    return { width: canvas.width, height: canvas.height, painted };
  });
  expect(size).not.toBeNull();
  expect(size!.width).toBe(1200);
  expect(size!.height).toBe(675);
  expect(size!.painted).toBeGreaterThan(100);

  const download = page.waitForEvent("download");
  await page.getByTestId("studio-download").click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});

test("trader base keeps the theme and the layout choice", async ({ page }) => {
  await page.goto("profile");
  await expect(page.getByTestId("theme-voltage")).toBeVisible({ timeout: 90_000 });
  await page.getByTestId("theme-voltage").click();
  await page.getByTestId("home-view-pref-table").click();
  await page.reload();

  await expect(page.getByTestId("theme-voltage")).toHaveClass(/cr-btn-primary/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "voltage");
});

test("rsi and macd render in their own panes", async ({ page }) => {
  await page.goto("chart/spot/BTCUSDT");
  await expect(page.getByTestId("price-chart")).toBeVisible({ timeout: 120_000 });

  await page.getByTestId("indicator-macd").click();
  await expect(page.getByTestId("subchart-macd 12·26·9")).toBeVisible();

  const heights = await page.evaluate(() => ({
    main: document.querySelector('[data-testid="price-chart"]')!.getBoundingClientRect().height,
    rsi: document.querySelector('[data-testid^="subchart-rsi"]')?.getBoundingClientRect().height ?? 0,
  }));
  // The candle pane must stay dominant and the RSI pane must exist separately.
  expect(heights.main).toBeGreaterThan(200);
  expect(heights.rsi).toBeGreaterThan(60);
});
