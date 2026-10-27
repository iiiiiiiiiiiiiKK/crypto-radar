import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4174/crypto-radar";
const OUT = path.resolve("docs/screenshots");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: "command", path: "/" },
  { name: "markets", path: "/markets" },
  { name: "radar", path: "/radar" },
  { name: "charts", path: "/charts" },
  { name: "studio", path: "/studio" },
  { name: "watchlist", path: "/watchlist" },
  { name: "settings", path: "/settings" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "phone", width: 430, height: 932 },
  { name: "phone-sm", width: 390, height: 844 },
];

const measure = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const parsed = (color) => {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(",").map((value) => Number(value.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const backgroundOf = (element) => {
    let node = element;
    while (node) {
      const bg = parsed(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.85) return bg;
      node = node.parentElement;
    }
    return { r: 6, g: 8, b: 11, a: 1 };
  };

  const contrastOf = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const style = getComputedStyle(element);
    const fg = parsed(style.color);
    if (!fg) return null;
    const bg = backgroundOf(element);
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { ratio: Math.round(ratio * 10) / 10, size: style.fontSize, color: style.color };
  };

  const clipped = [];
  for (const element of document.querySelectorAll("h1,h2,h3,p,span,div,button,a")) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.right > vw + 1 && rect.left >= 0) {
      const text = (element.textContent ?? "").trim().slice(0, 20);
      if (text) clipped.push(`${element.tagName}:${text}`);
    }
  }

  const box = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top) };
  };

  return {
    vw,
    vh,
    overflow: document.documentElement.scrollWidth - vw,
    clipped: clipped.slice(0, 8),
    docHeight: document.documentElement.scrollHeight,
    boxes: {
      sitrep: box(".sitrep"),
      feed: box(".feed__scroll"),
      movers: box(".movers__list"),
      grid: box(".mkt"),
      chart: box(".chartstack"),
      canvas: box(".studio__canvas"),
      rail: box(".rail"),
      mobilebar: box(".mobilebar"),
      topbar: box(".topbar"),
    },
    contrast: {
      h1: contrastOf("h1"),
      desc: contrastOf(".page__desc"),
      panelTitle: contrastOf(".panel__title"),
      cell: contrastOf(".mkt__cell"),
      why: contrastOf(".feed__why"),
      mood: contrastOf(".mood__label"),
      tag: contrastOf(".tag"),
      label: contrastOf(".label"),
    },
    counts: {
      rows: document.querySelectorAll('[data-testid="market-row"]').length,
      events: document.querySelectorAll('[data-testid="event-row"]').length,
      movers: document.querySelectorAll(".mover").length,
      results: document.querySelectorAll(".results__row").length,
      panels: document.querySelectorAll(".panel").length,
      canvases: document.querySelectorAll("canvas").length,
    },
    pill: document.querySelector('[data-testid="connection-pill"]')?.getAttribute("data-state") ?? null,
    mood: document.querySelector('[data-testid="mood-label"]')?.textContent ?? null,
    hasNaN: /NaN|Infinity|undefined%/.test(document.body.innerText),
    buttons: document.querySelectorAll("button").length,
    textLength: document.body.innerText.length,
  };
};

const report = { pages: [], consoleErrors: [] };
const browser = await chromium.launch({ channel: "chrome" });

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.consoleErrors.push(`${viewport.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text().slice(0, 160)}`);
  });

  for (const target of PAGES) {
    try {
      await page.goto(`${BASE}${target.path}`, { waitUntil: "domcontentloaded" });
      try {
        await page.waitForSelector('[data-testid="connection-pill"][data-state="live"]', { timeout: 30_000 });
      } catch {
        /* the pill state is recorded below */
      }
      await page.waitForTimeout(target.name === "charts" ? 6000 : 4500);
      const facts = await page.evaluate(measure);
      report.pages.push({ viewport: viewport.name, page: target.name, ...facts });
      await page.screenshot({
        path: path.join(OUT, `${viewport.name}-${target.name}.png`),
        fullPage: viewport.name !== "desktop" && viewport.name !== "laptop",
      });
      console.log(
        `${viewport.name.padEnd(8)} ${target.name.padEnd(9)} overflow=${String(facts.overflow).padStart(3)} ` +
          `rows=${String(facts.counts.rows).padStart(4)} events=${String(facts.counts.events).padStart(2)} ` +
          `panels=${facts.counts.panels} docH=${facts.docHeight} grid=${facts.boxes.grid?.h ?? "-"} ` +
          `chart=${facts.boxes.chart?.h ?? "-"} mood=${facts.mood ?? "-"}`,
      );
      if (facts.clipped.length) console.log(`   outside viewport: ${facts.clipped.slice(0, 3).join(" | ")}`);
      if (facts.hasNaN) console.log("   !! NaN/undefined in text");
    } catch (error) {
      console.log(`${viewport.name} ${target.name} FAILED: ${String(error).split("\n")[0]}`);
      report.pages.push({ viewport: viewport.name, page: target.name, error: String(error).slice(0, 200) });
    }
  }
  await context.close();
}

await browser.close();
fs.writeFileSync("audit-report.json", JSON.stringify(report, null, 2), "utf8");
console.log("\nconsole errors:", report.consoleErrors.length ? report.consoleErrors.slice(0, 10) : "none");
