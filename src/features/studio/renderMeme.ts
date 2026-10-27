import type { Candle, MarketTicker } from "@/types/market";

export type StudioTheme = "pixel" | "comic" | "terminal";
export type StudioRatio = "x" | "square";

export interface MemeRenderInput {
  ticker: MarketTicker;
  candles: Candle[];
  theme: StudioTheme;
  ratio: StudioRatio;
  headline: string;
  caption: string;
  marketLabel: string;
  /** Timestamp of the data shown in the card. */
  dataTime: number;
  includeChart: boolean;
  brand?: string;
}

export const CANVAS_SIZE: Record<StudioRatio, { width: number; height: number }> = {
  x: { width: 1200, height: 675 },
  square: { width: 1080, height: 1080 },
};

const PALETTE = {
  bg: "#07080d",
  panel: "#0e1018",
  line: "#232a3d",
  text: "#e8eefc",
  muted: "#7d879e",
  up: "#39ff88",
  down: "#ff3b6b",
  voltage: "#b14cff",
  warn: "#ffe94a",
  cyan: "#33e1ff",
};

function formatPrice(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(decimals, 8),
    maximumFractionDigits: Math.min(decimals, 8),
  });
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

function formatStamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Draws a scanline overlay — the shared texture of all three themes. */
function scanlines(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#39ff88";
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.restore();
}

function pixelCorners(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const corners = [
    [x, y, 1, 1],
    [x + width, y, -1, 1],
    [x, y + height, 1, -1],
    [x + width, y + height, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * size, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * size);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSparkline(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  if (candles.length < 2) return;
  const closes = candles.map((candle) => candle.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  closes.forEach((close, index) => {
    const px = x + (index / (closes.length - 1)) * width;
    const py = y + height - ((close - min) / span) * height;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders the share card onto a canvas.
 *
 * Everything drawn here comes from the ticker and the candles passed in, and
 * the data timestamp is printed on the card, so a shared image can never be
 * mistaken for a live quote.
 */
export function renderMeme(input: MemeRenderInput): HTMLCanvasElement {
  const { width, height } = CANVAS_SIZE[input.ratio];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const up = input.ticker.priceChangePercent >= 0;
  const accent = up ? PALETTE.up : PALETTE.down;
  const brand = input.brand ?? "CRYPTO RADAR";
  const mono = '"JetBrains Mono", Menlo, Consolas, monospace';
  const sans =
    'Inter, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

  // background
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, width, height);

  if (input.theme === "comic") {
    // halftone dots
    ctx.save();
    ctx.fillStyle = "rgba(177,76,255,0.10)";
    for (let y = 0; y < height; y += 18) {
      for (let x = (y / 18) % 2 === 0 ? 0 : 9; x < width; x += 18) {
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  if (input.theme === "terminal") {
    ctx.strokeStyle = "rgba(35,42,61,0.7)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // accent frame
  const pad = Math.round(width * 0.045);
  if (input.theme === "pixel") {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
    pixelCorners(ctx, pad, pad, width - pad * 2, height - pad * 2, 22, accent);
    scanlines(ctx, width, height, 0.06);
  } else if (input.theme === "comic") {
    ctx.fillStyle = "rgba(14,16,24,0.92)";
    ctx.fillRect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 10;
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(pad + 8, pad + 8, width - pad * 2 - 16, height - pad * 2 - 16);
  }

  // brand
  ctx.textBaseline = "top";
  ctx.fillStyle = accent;
  ctx.font = `700 ${Math.round(width * 0.019)}px ${mono}`;
  ctx.fillText("◎ " + brand.toUpperCase(), pad + 34, pad + 30);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 ${Math.round(width * 0.014)}px ${mono}`;
  ctx.textAlign = "right";
  ctx.fillText(input.marketLabel.toUpperCase(), width - pad - 34, pad + 34);
  ctx.textAlign = "left";

  // symbol + headline
  const symbolSize = Math.round(width * 0.075);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 ${symbolSize}px ${input.theme === "comic" ? sans : mono}`;
  ctx.fillText(input.ticker.symbol, pad + 34, pad + 78);

  if (input.headline) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(width * 0.026)}px ${sans}`;
    ctx.fillText(input.headline.slice(0, 40), pad + 34, pad + 78 + symbolSize + 10);
  }

  // price + change
  const priceY = height * 0.52;
  const priceSize = Math.round(width * 0.062);
  ctx.fillStyle = accent;
  ctx.font = `800 ${priceSize}px ${mono}`;
  ctx.fillText(formatPrice(input.ticker.price, input.ticker.decimals), pad + 34, priceY);

  const changeText = `${up ? "+" : ""}${input.ticker.priceChangePercent.toFixed(2)}%`;

  // change badge
  ctx.font = `800 ${Math.round(width * 0.03)}px ${mono}`;
  const badgeWidth = ctx.measureText(changeText).width + 28;
  const badgeY = priceY + priceSize + 14;
  ctx.fillStyle = up ? "rgba(57,255,136,0.16)" : "rgba(255,59,107,0.16)";
  ctx.fillRect(pad + 34, badgeY, badgeWidth, Math.round(width * 0.042));
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(pad + 34, badgeY, badgeWidth, Math.round(width * 0.042));
  ctx.fillStyle = accent;
  ctx.fillText(changeText, pad + 48, badgeY + Math.round(width * 0.006));

  // volume + range
  const metaY = badgeY + Math.round(width * 0.06);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 ${Math.round(width * 0.017)}px ${mono}`;
  const meta = [
    input.ticker.quoteVolume24h === null
      ? null
      : `VOL ${formatCompact(input.ticker.quoteVolume24h)}`,
    input.ticker.high24h === null ? null : `H ${formatPrice(input.ticker.high24h, input.ticker.decimals)}`,
    input.ticker.low24h === null ? null : `L ${formatPrice(input.ticker.low24h, input.ticker.decimals)}`,
    input.ticker.fundingRate === null
      ? null
      : `FUND ${(input.ticker.fundingRate * 100).toFixed(4)}%`,
  ]
    .filter(Boolean)
    .join("   ");
  ctx.fillText(meta, pad + 34, metaY);

  // sparkline on the right
  if (input.includeChart && input.candles.length > 1) {
    const chartW = width * 0.36;
    const chartH = height * 0.28;
    const chartX = width - pad - 34 - chartW;
    const chartY = height * 0.42;
    ctx.strokeStyle = "rgba(35,42,61,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(chartX, chartY, chartW, chartH);
    drawSparkline(ctx, input.candles, chartX, chartY, chartW, chartH, accent);
  }

  // caption
  if (input.caption) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 ${Math.round(width * 0.02)}px ${sans}`;
    const maxWidth = width - pad * 2 - 68 - (input.includeChart ? width * 0.38 : 0);
    const words = input.caption.slice(0, 120).split("");
    let line = "";
    let lineY = height - pad - Math.round(width * 0.075);
    for (const char of words) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, pad + 34, lineY);
        line = char;
        lineY += Math.round(width * 0.026);
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, pad + 34, lineY);
  }

  // data timestamp — always visible so the card cannot look "live"
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 ${Math.round(width * 0.015)}px ${mono}`;
  ctx.fillText(
    `DATA ${formatStamp(input.dataTime)} · X @0xkillcoin`,
    pad + 34,
    height - pad - Math.round(width * 0.03),
  );

  // accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(pad, height - pad - 6, width - pad * 2, 3);

  return canvas;
}

/** Triggers a PNG download for the rendered card. */
export async function downloadMeme(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
