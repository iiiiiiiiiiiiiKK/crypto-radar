/**
 * Layout audit: checks every page on every device profile for horizontal
 * overflow, clipped text and elements that stick out of the viewport.
 *
 * Usage:
 *   BASE=http://127.0.0.1:4173/crypto-radar/ \
 *   PROXY=http://127.0.0.1:7897 node scripts/audit-layout.mjs
 */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const base = process.env.BASE ?? "http://127.0.0.1:4173/crypto-radar/";
const proxy = process.env.PROXY ?? "";
const out = process.env.OUT ?? "layout-audit.txt";

const DEVICES = [
  ["iPhone SE", 375, 667, 2, true],
  ["iPhone 13", 390, 844, 3, true],
  ["iPhone 15 Pro Max", 430, 932, 3, true],
  ["iPad mini", 744, 1133, 2, true],
  ["Desktop", 1440, 900, 1, false],
];

const PAGES = [
  "",
  "spot",
  "perp",
  "alpha",
  "basis",
  "screener",
  "alerts",
  "watchlists",
  "settings",
];

const lines = [];
const browser = await chromium.launch({
  channel: "chrome",
  proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1" } : undefined,
});

let problems = 0;

for (const [label, width, height, dpr, isMobile] of DEVICES) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    isMobile,
    hasTouch: isMobile,
    locale: "zh-CN",
  });
  const page = await context.newPage();
  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const result = await page.evaluate(() => {
      const doc = document.documentElement;
      const clipped = [...document.querySelectorAll("button, a, span, div, li, td")]
        .filter(
          (el) =>
            el.children.length === 0 &&
            el.textContent.trim() &&
            el.scrollWidth > el.clientWidth + 1 &&
            getComputedStyle(el).overflow !== "visible",
        )
        .slice(0, 5)
        .map((el) => el.tagName + ":" + el.textContent.trim().slice(0, 18));
      const outside = [...document.querySelectorAll("body *")]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          if (rect.right <= doc.clientWidth + 2) return false;
          // Elements inside a horizontally scrollable container are fine.
          let parent = el.parentElement;
          while (parent) {
            const overflowX = getComputedStyle(parent).overflowX;
            if (overflowX === "auto" || overflowX === "scroll") return false;
            parent = parent.parentElement;
          }
          return true;
        })
        .slice(0, 5)
        .map((el) => el.tagName + "." + String(el.className).slice(0, 36));
      return {
        overflow: doc.scrollWidth - doc.clientWidth,
        clipped,
        outside,
      };
    });

    const ok = result.overflow <= 2 && result.clipped.length === 0 && result.outside.length === 0;
    if (!ok) problems += 1;
    lines.push(
      `${ok ? "OK  " : "FAIL"} ${label.padEnd(17)} ${(path || "/").padEnd(11)} ` +
        `overflow=${result.overflow} clipped=${result.clipped.join(",") || "none"} ` +
        `outside=${result.outside.join(",") || "none"}`,
    );
  }
  await context.close();
}

await writeFile(out, lines.join("\n"));
console.log(lines.join("\n"));
console.log(problems === 0 ? "\nAll layouts are clean." : `\n${problems} layout problems found.`);
await browser.close();
process.exit(problems === 0 ? 0 : 1);
