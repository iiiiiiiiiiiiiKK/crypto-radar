import { expect, test } from "@playwright/test";

/**
 * Mobile layout tests.
 *
 * The phone layout is a dedicated design — a card list instead of the dense
 * desktop grid — so these tests verify the phone presentation, not a squeezed
 * desktop page.
 */

const PHONE = { width: 390, height: 844 };

test("phone shows the card list instead of the wide grid", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });

  // The desktop header row must not be used on a phone.
  await expect(page.locator(".cr-table-head")).toHaveCount(0);

  // The card list renders the pair, the price and the 24 h change.
  const row = page.getByTestId("market-row").first();
  const text = await row.innerText();
  expect(text).toMatch(/\d/);
});

test("phone layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize(PHONE);
  for (const path of ["", "spot", "perp", "alpha", "screener", "watchlists", "settings"]) {
    await page.goto(path);
    await page.waitForTimeout(4000);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth, `horizontal overflow on ${path}`).toBeLessThanOrEqual(
      overflow.clientWidth + 2,
    );
  }
});

test("phone shows the bottom navigation and hides the sidebar", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("spot");
  const bottomNav = page.getByRole("navigation", { name: "Primary mobile" });
  await expect(bottomNav).toBeVisible();
  // The desktop sidebar must not take part in the layout on a phone.
  await expect(page.locator("aside")).toBeHidden();
});

test("phone chart keeps the interval and indicator controls reachable", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });
  await page.getByTestId("market-row").first().click();
  await expect(page.getByTestId("price-chart")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("interval-1h")).toBeVisible();
  await expect(page.getByTestId("indicator-ma")).toBeVisible();
});

test("the bottom bar never covers the last market row", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("spot");
  await expect(page.getByTestId("market-row").first()).toBeVisible({ timeout: 90_000 });

  // Scroll to the end of the list and compare the last row with the nav top.
  const result = await page.evaluate(() => {
    const scroller = document.querySelector('[data-testid="market-table"]') as HTMLElement | null;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    const nav = document.querySelector('[data-testid="mobile-nav"]') as HTMLElement | null;
    const rows = document.querySelectorAll('[data-testid="market-row"]');
    const last = rows[rows.length - 1] as HTMLElement | undefined;
    return {
      navTop: nav ? nav.getBoundingClientRect().top : window.innerHeight,
      lastBottom: last ? last.getBoundingClientRect().bottom : 0,
      rows: rows.length,
    };
  });
  // The list must stop above the navigation bar, not underneath it.
  expect(result.lastBottom).toBeLessThanOrEqual(result.navTop + 1);
});

test("dialogs stay inside the viewport", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("watchlists");
  await page.getByRole("button", { name: /新建列表|New list/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
});

test("the author X link points to the profile", async ({ page }) => {
  await page.goto("");
  const link = page.getByTestId("author-x-link");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://x.com/0xkillcoin");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});
