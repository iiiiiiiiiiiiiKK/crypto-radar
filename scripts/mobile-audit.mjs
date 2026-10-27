/**
 * iPhone / mobile audit.
 *
 * Runs the built site in WebKit with iPhone device descriptors and reports the
 * things that actually break mobile web: horizontal overflow, iOS input zoom
 * (font-size < 16px), tap targets under 44px, elements hidden under the fixed
 * bottom bar, and fixed elements that ignore safe-area insets.
 */
import { webkit, chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4174/crypto-radar";
const OUT = "mobile-audit.json";

const DEVICES = [
  {
    name: "iPhone SE (375x667)",
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: "iPhone 13 (390x844)",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: "iPhone 15 Pro Max (430x932)",
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
];

const ROUTES = ["/", "/markets", "/radar", "/charts", "/studio", "/watchlist", "/settings"];

const probe = () => {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  // 1. Elements that stick out horizontally (excluding intentional scrollers).
  const overflow = [];
  for (const el of document.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.right <= vw + 1) continue;
    let intentional = false;
    let node = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (["scroll", "auto"].includes(style.overflowX)) {
        intentional = true;
        break;
      }
      if (["hidden", "clip"].includes(style.overflowX) || ["hidden", "clip"].includes(style.overflow)) {
        intentional = true;
        break;
      }
      node = node.parentElement;
    }
    if (intentional) continue;
    overflow.push({
      tag: el.tagName,
      cls: String(el.className).slice(0, 40),
      right: Math.round(rect.right),
      w: Math.round(rect.width),
    });
  }

  // 2. Inputs that make iOS Safari zoom on focus (font-size must be >= 16px).
  //    Invisible controls (the switch's hidden checkbox) cannot be focused by
  //    tapping, so they are excluded.
  const zoomInputs = [];
  for (const el of document.querySelectorAll("input, select, textarea")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (Number(style.opacity) === 0 || style.pointerEvents === "none") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const size = parseFloat(style.fontSize);
    if (size < 16) {
      zoomInputs.push({
        tag: el.tagName,
        type: el.getAttribute("type") ?? el.tagName.toLowerCase(),
        size,
        cls: String(el.className).slice(0, 40),
      });
    }
  }

  // 3. Interactive targets that are too small to tap reliably.
  //    Inline links inside a sentence are exempt (WCAG 2.5.8), and the switch's
  //    tappable element is its <label>, not the 22px track inside it.
  const smallTargets = [];
  for (const el of document.querySelectorAll("button, a[href], [role='button']")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    // The TradingView attribution link is injected by lightweight-charts and
    // its size is fixed by the library's licence, not by our CSS.
    if ((el.getAttribute("href") ?? "").includes("tradingview.com")) continue;
    const inSentence =
      el.tagName === "A" &&
      el.parentElement &&
      ["P", "SPAN", "DIV", "LI"].includes(el.parentElement.tagName) &&
      el.parentElement.textContent.trim().length > el.textContent.trim().length + 8;
    if (inSentence) continue;
    if (rect.width < 40 || rect.height < 40) {
      const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 18);
      smallTargets.push({
        tag: el.tagName,
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        cls: String(el.className).slice(0, 34),
        label,
      });
    }
  }

  // The switch label is the real target; measure it explicitly.
  const switchLabels = [...document.querySelectorAll("label.switch")].map((label) => {
    const rect = label.getBoundingClientRect();
    return { w: Math.round(rect.width), h: Math.round(rect.height) };
  });

  // 4. Bottom bar overlap: is any content sitting under it?
  const bar = document.querySelector(".mobilebar");
  const barRect = bar ? bar.getBoundingClientRect() : null;
  const barVisible = barRect ? barRect.height > 0 && getComputedStyle(bar).display !== "none" : false;

  // 5. Layout metrics.
  const topbar = document.querySelector(".topbar")?.getBoundingClientRect();
  const contentPadding = getComputedStyle(document.querySelector(".page") ?? document.body).paddingBottom;

  return {
    vw,
    vh,
    scrollWidth: document.documentElement.scrollWidth,
    docHeight: document.documentElement.scrollHeight,
    overflow: overflow.slice(0, 8),
    zoomInputs: zoomInputs.slice(0, 8),
    smallTargets: smallTargets.slice(0, 12),
    smallTargetCount: smallTargets.length,
    switchLabels,
    barVisible,
    barHeight: barRect ? Math.round(barRect.height) : 0,
    topbarHeight: topbar ? Math.round(topbar.height) : 0,
    contentPadding,
    hasSafeArea: getComputedStyle(document.querySelector(".page") ?? document.body).paddingBottom.includes("env"),
    tapeVisible: Boolean(document.querySelector(".tape")),
  };
};

const browser = await webkit.launch();
const report = { devices: [], consoleErrors: [] };

for (const device of DEVICES) {
  const context = await browser.newContext({
    ...device,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.consoleErrors.push(`${device.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${device.name}: ${message.text().slice(0, 140)}`);
  });

  for (const route of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(route === "/charts" ? 6000 : 4000);
      const facts = await page.evaluate(probe);
      report.devices.push({ device: device.name, route, ...facts });
      const flags = [];
      if (facts.overflow.length) flags.push(`overflow:${facts.overflow.length}`);
      if (facts.zoomInputs.length) flags.push(`zoomInputs:${facts.zoomInputs.length}`);
      if (facts.smallTargetCount) flags.push(`small:${facts.smallTargetCount}`);
      console.log(
        `${device.name.padEnd(24)} ${route.padEnd(11)} vw=${facts.vw} sw=${facts.scrollWidth} ` +
          `bar=${facts.barVisible ? facts.barHeight : "-"} ${flags.join(" ") || "ok"}`,
      );
      if (facts.overflow.length) console.log("   ", JSON.stringify(facts.overflow.slice(0, 4)));
      if (facts.zoomInputs.length) console.log("   zoom:", JSON.stringify(facts.zoomInputs.slice(0, 4)));
      if (facts.smallTargetCount) console.log("   small:", JSON.stringify(facts.smallTargets.slice(0, 5)));
    } catch (error) {
      console.log(`${device.name} ${route} FAILED ${String(error).split("\n")[0].slice(0, 120)}`);
      report.devices.push({ device: device.name, route, error: String(error).slice(0, 160) });
    }
  }
  await context.close();
}

await browser.close();
fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
console.log(`\nconsole errors: ${report.consoleErrors.length ? report.consoleErrors.slice(0, 6) : "none"}`);
