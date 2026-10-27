/**
 * Canvas renderer for share cards.
 *
 * All text is measured and wrapped before it is drawn, so an export can never
 * clip a symbol, a headline or the data timestamp. Everything printed on the
 * card is passed in from live market data — the renderer never invents a value.
 */

export type CardTemplate = "rocket" | "rekt" | "fomo" | "sleep" | "board";
export type CardRatio = "x" | "square";

export interface CardInput {
  template: CardTemplate;
  ratio: CardRatio;
  symbol: string;
  base: string;
  quote: string;
  price: number | null;
  change: number | null;
  decimals: number;
  marketLabel: string;
  headline: string;
  caption: string;
  quoteVolume: number | null;
  funding: number | null;
  spark: number[];
  board: Array<{ base: string; change: number | null; quoteVolume: number | null }>;
  fields: { price: boolean; change: boolean; volume: boolean; spark: boolean };
  dataTime: number;
  source: string;
}

export const TEMPLATES: Array<{ id: CardTemplate; name: string; desc: string }> = [
  { id: "rocket", name: "冲了", desc: "暴涨现场，箭头与斜条纹" },
  { id: "rekt", name: "崩了", desc: "暴跌葬礼，裂痕与暗红" },
  { id: "fomo", name: "FOMO", desc: "全场点火，波点狂欢" },
  { id: "sleep", name: "装死", desc: "横盘无语，Zzz 待机" },
  { id: "board", name: "今日最离谱", desc: "排行榜卡片，最多 5 条" },
];

const PALETTE = {
  bg: "#070a0f",
  panel: "#0b1117",
  line: "#1b242e",
  text: "#edf3f9",
  dim: "#93a3b1",
  mute: "#5d6b78",
  up: "#00f5a0",
  down: "#ff4d67",
  violet: "#b18cff",
  amber: "#ffd166",
  blue: "#55b8ff",
};

const FONT_DISPLAY = '"Bahnschrift", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
const FONT_MONO = '"Cascadia Mono", "SF Mono", Consolas, "PingFang SC", "Microsoft YaHei", monospace';

/** 9x9 pixel eye mascot — original artwork, drawn as blocks. */
const MASCOT = [
  "..#####..",
  ".#######.",
  "##..#..##",
  "#...#...#",
  "#...#...#",
  "##..#..##",
  ".#######.",
  "..#####..",
  ".........",
];

function formatPrice(value: number | null, decimals: number): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(decimals, 8),
    maximumFractionDigits: Math.min(decimals, 8),
  });
}

function compact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function stamp(timestamp: number): string {
  const d = new Date(timestamp);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

/** Shrinks the font until the text fits the measured width. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  font: (size: number) => string,
  minSize = Math.max(14, startSize * 0.45),
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

/** Greedy wrap by character (works for CJK) with a hard line budget. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines) {
        line = "";
        break;
      }
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  if (lines.length === maxLines) {
    // Mark truncation honestly instead of cutting mid-glyph.
    const last = lines[maxLines - 1];
    if (last.length > 2 && ctx.measureText(last + "…").width <= maxWidth) {
      lines[maxLines - 1] = last.endsWith("…") ? last : `${last}…`;
    }
  }
  return lines;
}

function drawMascot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pixel: number,
  color: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  MASCOT.forEach((row, rowIndex) => {
    [...row].forEach((cell, colIndex) => {
      if (cell === "#") ctx.fillRect(x + colIndex * pixel, y + rowIndex * pixel, pixel, pixel);
    });
  });
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(85,184,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpark(
  ctx: CanvasRenderingContext2D,
  values: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  if (values.length < 2) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  ctx.save();
  ctx.strokeStyle = "rgba(27,36,46,1)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.beginPath();
  values.forEach((value, index) => {
    const px = x + (index / (values.length - 1)) * width;
    const py = y + height - ((value - min) / span) * (height - 12) - 6;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** Renders the card into the provided canvas (which it resizes). */
export function renderCard(canvas: HTMLCanvasElement, input: CardInput): void {
  const width = input.ratio === "x" ? 1200 : 1080;
  const height = input.ratio === "x" ? 675 : 1080;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const up = (input.change ?? 0) >= 0;
  const accent = input.template === "fomo" || input.template === "sleep"
    ? PALETTE.violet
    : up
      ? PALETTE.up
      : PALETTE.down;
  const pad = Math.round(width * 0.052);

  // background
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height);

  // template decoration
  if (input.template === "rocket") {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = PALETTE.up;
    ctx.lineWidth = 22;
    for (let i = -height; i < width; i += 90) {
      ctx.beginPath();
      ctx.moveTo(i, height);
      ctx.lineTo(i + height, 0);
      ctx.stroke();
    }
    ctx.restore();
  } else if (input.template === "rekt") {
    ctx.save();
    ctx.fillStyle = "rgba(255,77,103,0.08)";
    ctx.fillRect(0, 0, width, height * 0.32);
    ctx.strokeStyle = "rgba(255,77,103,0.25)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(width * 0.1 + i * 90, height);
      ctx.lineTo(width * 0.3 + i * 60, height * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  } else if (input.template === "fomo") {
    ctx.save();
    ctx.fillStyle = "rgba(177,140,255,0.10)";
    for (let y = 0; y < height; y += 22) {
      for (let x = (y / 22) % 2 === 0 ? 0 : 11; x < width; x += 22) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  } else if (input.template === "sleep") {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = PALETTE.violet;
    ctx.font = `700 90px ${FONT_MONO}`;
    ctx.fillText("z", width - pad - 150, height * 0.42);
    ctx.font = `700 60px ${FONT_MONO}`;
    ctx.fillText("z", width - pad - 210, height * 0.52);
    ctx.font = `700 38px ${FONT_MONO}`;
    ctx.fillText("z", width - pad - 250, height * 0.6);
    ctx.restore();
  }

  // frame + HUD corners
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(pad * 0.45, pad * 0.45, width - pad * 0.9, height - pad * 0.9);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  const corner = 26;
  const bx = pad * 0.45;
  const by = pad * 0.45;
  const bw = width - pad * 0.9;
  const bh = height - pad * 0.9;
  ctx.beginPath();
  ctx.moveTo(bx, by + corner);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + corner, by);
  ctx.moveTo(bx + bw - corner, by + bh);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw, by + bh - corner);
  ctx.stroke();

  // header
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 ${Math.round(width * 0.021)}px ${FONT_DISPLAY}`;
  ctx.fillText("CRYPTO RADAR", pad, pad + 14);
  const brandWidth = ctx.measureText("CRYPTO RADAR").width;
  drawMascot(ctx, pad + brandWidth + 14, pad - 8, 4, accent);

  ctx.font = `500 ${Math.round(width * 0.014)}px ${FONT_MONO}`;
  ctx.fillStyle = PALETTE.mute;
  ctx.textAlign = "right";
  ctx.fillText(`${input.marketLabel.toUpperCase()} · MEME CARD`, width - pad, pad + 12);
  ctx.textAlign = "left";

  // underline
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad + 30);
  ctx.lineTo(width - pad, pad + 30);
  ctx.stroke();

  if (input.template === "board") {
    drawBoardLayout(ctx, input, width, height, pad, accent);
    drawFooter(ctx, input, width, height, pad, accent);
    return;
  }

  // symbol
  const titleY = pad + Math.round(height * 0.19);
  const symbolSize = fitText(
    ctx,
    input.base,
    width - pad * 2 - (input.fields.spark ? width * 0.34 : 0),
    Math.round(width * 0.11),
    (size) => `700 ${size}px ${FONT_DISPLAY}`,
    42,
  );
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 ${symbolSize}px ${FONT_DISPLAY}`;
  ctx.fillText(input.base, pad, titleY);

  const symbolWidth = measure(ctx, input.base, `700 ${symbolSize}px ${FONT_DISPLAY}`);
  const quoteFont = `500 ${Math.round(symbolSize * 0.34)}px ${FONT_MONO}`;
  ctx.font = quoteFont;
  ctx.fillStyle = PALETTE.mute;
  const quoteText = `/${input.quote || "USDT"}`;
  const quoteX = pad + symbolWidth + 12;
  if (quoteX + ctx.measureText(quoteText).width < width - pad) {
    ctx.fillText(quoteText, quoteX, titleY);
  }

  // price
  let cursorY = titleY + Math.round(height * 0.13);
  if (input.fields.price) {
    const priceText = formatPrice(input.price, input.decimals);
    const priceSize = fitText(ctx, priceText, width * 0.62, Math.round(width * 0.07), (size) => `600 ${size}px ${FONT_MONO}`, 28);
    ctx.fillStyle = accent;
    ctx.font = `600 ${priceSize}px ${FONT_MONO}`;
    ctx.fillText(priceText, pad, cursorY);
    cursorY += Math.round(priceSize * 1.0);
  }

  // 24h change badge
  if (input.fields.change && input.change !== null) {
    const text = `${input.change >= 0 ? "+" : ""}${input.change.toFixed(2)}%`;
    ctx.font = `700 ${Math.round(width * 0.028)}px ${FONT_MONO}`;
    const textWidth = ctx.measureText(text).width;
    const badgeW = textWidth + 32;
    const badgeH = Math.round(width * 0.042);
    cursorY += 12;
    ctx.fillStyle = up ? "rgba(0,245,160,0.14)" : "rgba(255,77,103,0.14)";
    ctx.fillRect(pad, cursorY, badgeW, badgeH);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, cursorY, badgeW, badgeH);
    ctx.fillStyle = accent;
    ctx.fillText(text, pad + 16, cursorY + badgeH - 12);
    cursorY += badgeH + 16;
  }

  // volume / funding line
  if (input.fields.volume) {
    ctx.font = `500 ${Math.round(width * 0.016)}px ${FONT_MONO}`;
    ctx.fillStyle = PALETTE.dim;
    const meta = [
      input.quoteVolume !== null ? `VOL ${compact(input.quoteVolume)}` : null,
      input.funding !== null ? `FUND ${(input.funding * 100).toFixed(4)}%` : null,
    ]
      .filter(Boolean)
      .join("   ");
    if (meta) ctx.fillText(meta, pad, cursorY);
    cursorY += Math.round(width * 0.03);
  }

  // sparkline panel (right)
  if (input.fields.spark) {
    const sparkW = Math.round(width * 0.3);
    const sparkH = Math.round(height * 0.24);
    drawSpark(ctx, input.spark, width - pad - sparkW, titleY - sparkH * 0.55, sparkW, sparkH, accent);
  }

  // headline + caption
  const textWidth = input.fields.spark ? width * 0.58 : width - pad * 2;
  if (input.headline) {
    const size = fitText(ctx, input.headline, textWidth, Math.round(width * 0.032), (px) => `700 ${px}px ${FONT_DISPLAY}`, 20);
    ctx.font = `700 ${size}px ${FONT_DISPLAY}`;
    ctx.fillStyle = accent;
    ctx.fillText(input.headline, pad, Math.min(cursorY + size, height - pad - 80));
    cursorY += size + 8;
  }

  if (input.caption) {
    ctx.font = `500 ${Math.round(width * 0.017)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = PALETTE.dim;
    const lines = wrapText(ctx, input.caption, textWidth, 2);
    lines.forEach((line, index) => {
      ctx.fillText(line, pad, Math.min(cursorY + 14 + index * Math.round(width * 0.025), height - pad - 48));
    });
  }

  drawFooter(ctx, input, width, height, pad, accent);
}

function measure(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const previous = ctx.font;
  ctx.font = font;
  const width = ctx.measureText(text).width;
  ctx.font = previous;
  return width;
}

function drawBoardLayout(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  width: number,
  height: number,
  pad: number,
  accent: string,
) {
  ctx.fillStyle = accent;
  ctx.font = `700 ${Math.round(width * 0.032)}px ${FONT_DISPLAY}`;
  ctx.fillText(input.headline || "今日最离谱", pad, pad + Math.round(height * 0.12));

  const rows = input.board.slice(0, 5);
  const startY = pad + Math.round(height * 0.18);
  const rowH = Math.round((height - startY - pad - 90) / Math.max(5, rows.length));
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.change ?? 0)));

  rows.forEach((row, index) => {
    const y = startY + index * rowH;
    ctx.fillStyle = index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent";
    ctx.fillRect(pad, y, width - pad * 2, rowH - 4);

    ctx.fillStyle = PALETTE.mute;
    ctx.font = `500 ${Math.round(width * 0.016)}px ${FONT_MONO}`;
    ctx.fillText(String(index + 1).padStart(2, "0"), pad + 12, y + rowH * 0.62);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 ${Math.round(width * 0.026)}px ${FONT_DISPLAY}`;
    ctx.fillText(row.base, pad + 56, y + rowH * 0.62);

    const change = row.change ?? 0;
    ctx.fillStyle = change >= 0 ? PALETTE.up : PALETTE.down;
    ctx.font = `600 ${Math.round(width * 0.022)}px ${FONT_MONO}`;
    ctx.textAlign = "right";
    ctx.fillText(`${change >= 0 ? "+" : ""}${change.toFixed(2)}%`, width - pad - 12, y + rowH * 0.62);
    ctx.textAlign = "left";

    // bar
    const barW = Math.round(width * 0.28);
    const barX = width - pad - 12 - barW - 130;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(barX, y + rowH * 0.42, barW, 5);
    ctx.fillStyle = change >= 0 ? PALETTE.up : PALETTE.down;
    ctx.fillRect(barX, y + rowH * 0.42, (Math.abs(change) / maxAbs) * barW, 5);
  });

  if (rows.length === 0) {
    ctx.fillStyle = PALETTE.mute;
    ctx.font = `500 ${Math.round(width * 0.02)}px ${FONT_MONO}`;
    ctx.fillText("数据不足，先等行情源接入。", pad, startY + 40);
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  width: number,
  height: number,
  pad: number,
  accent: string,
) {
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, height - pad - 34);
  ctx.lineTo(width - pad, height - pad - 34);
  ctx.stroke();

  ctx.fillStyle = PALETTE.mute;
  ctx.font = `500 ${Math.round(width * 0.0135)}px ${FONT_MONO}`;
  ctx.fillText(`DATA ${stamp(input.dataTime)}`, pad, height - pad - 12);

  ctx.textAlign = "right";
  ctx.fillText(input.source, width - pad, height - pad - 12);
  ctx.textAlign = "left";

  ctx.fillStyle = accent;
  ctx.fillRect(pad, height - pad - 6, width - pad * 2, 2);
}

export async function exportCard(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<boolean> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
