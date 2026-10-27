import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { Field, Modal, Seg, Switch } from "@/components/ui/Controls";
import { Notice, PageHead, Panel } from "@/components/ui/Panel";
import { exportCard, renderCard, TEMPLATES, type CardRatio, type CardTemplate } from "@/features/studio/renderCard";
import { engine } from "@/engine/engine";
import { useScanRows, useStoreVersion } from "@/hooks/useEngine";
import { useToasts } from "@/stores/ui";
import { searchRows } from "@/features/search/search";
import { formatCompact, formatFunding, formatPrice } from "@/lib/format";
import { MARKET_LABEL, type MarketId } from "@/types/market";

interface Snapshot {
  market: MarketId;
  symbol: string;
  base: string;
  quote: string;
  price: number | null;
  change: number | null;
  decimals: number;
  quoteVolume: number | null;
  funding: number | null;
  spark: number[];
  dataTime: number;
  board: Array<{ base: string; change: number | null; quoteVolume: number | null }>;
}

const DEFAULT_HEADLINES: Record<CardTemplate, string> = {
  rocket: "冲了。就这么简单。",
  rekt: "崩了，别问我为什么。",
  fomo: "全场都在 FOMO。",
  sleep: "横着走，谁也别动。",
  board: "今日最离谱行情。",
};

function captureSnapshot(market: MarketId, symbol: string): Snapshot | null {
  const row = engine.store.getRow(`${market}:${symbol}`);
  if (!row) return null;
  const board = engine.scanUniverse()
    .filter((item) => item.changePercent !== null && (item.quoteVolume24h ?? 0) > 100_000)
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))
    .slice(0, 5)
    .map((item) => ({
      base: item.base,
      change: item.changePercent,
      quoteVolume: item.quoteVolume24h,
    }));

  return {
    market,
    symbol: row.symbol,
    base: row.base,
    quote: row.quote,
    price: row.price,
    change: row.changePercent,
    decimals: row.decimals,
    quoteVolume: row.quoteVolume24h,
    funding: row.fundingRate,
    spark: engine.store.sparkline(row.key, 70),
    dataTime: row.receivedAt,
    board,
  };
}

export function StudioPage() {
  const [params] = useSearchParams();
  const rows = useScanRows();
  const pushToast = useToasts((state) => state.push);

  const initialMarket = (params.get("market") as MarketId) ?? "spot";
  const [market, setMarket] = useState<MarketId>(initialMarket);
  const [symbol, setSymbol] = useState(params.get("symbol") ?? (initialMarket === "alpha" ? "" : "BTCUSDT"));
  const [template, setTemplate] = useState<CardTemplate>((params.get("template") as CardTemplate) ?? "rocket");
  const [ratio, setRatio] = useState<CardRatio>("x");
  const [headline, setHeadline] = useState(params.get("headline") ?? DEFAULT_HEADLINES.rocket);
  const [caption, setCaption] = useState("");
  const [fields, setFields] = useState({ price: true, change: true, volume: true, spark: true });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const version = useStoreVersion();

  // Capture once the market row exists. A deep link can mount this page before
  // the first snapshot has been applied, so the capture retries on every store
  // flush until it succeeds.
  useEffect(() => {
    if (!symbol) {
      setSnapshot(null);
      return;
    }
    if (snapshot && snapshot.symbol === symbol && snapshot.market === market) return;
    const captured = captureSnapshot(market, symbol);
    if (captured) setSnapshot(captured);
  }, [market, symbol, version, snapshot]);

  useEffect(() => {
    if (template === "board") setHeadline(DEFAULT_HEADLINES.board);
    else if (DEFAULT_HEADLINES[template] && !headline) setHeadline(DEFAULT_HEADLINES[template]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    renderCard(canvas, {
      template,
      ratio,
      symbol: snapshot.symbol,
      base: snapshot.base,
      quote: snapshot.quote,
      price: snapshot.price,
      change: snapshot.change,
      decimals: snapshot.decimals,
      marketLabel: MARKET_LABEL[market],
      headline,
      caption,
      quoteVolume: snapshot.quoteVolume,
      funding: snapshot.funding,
      spark: snapshot.spark,
      board: snapshot.board,
      fields,
      dataTime: snapshot.dataTime,
      source: "BINANCE · PUBLIC API",
    });
  }, [snapshot, template, ratio, headline, caption, fields, market]);

  const candidates = useMemo(() => {
    const needle = query.trim();
    if (!needle) return rows.filter((row) => row.quote === "USDT").slice(0, 8);
    return searchRows(rows, needle, 8).map((hit) => engine.store.getRow(hit.key)).filter(Boolean);
  }, [rows, query]);

  const shareLink = useMemo(() => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("market", market);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("template", template);
    if (headline) url.searchParams.set("headline", headline);
    return url.toString();
  }, [market, symbol, template, headline]);

  const cap = snapshot
    ? `24h ${snapshot.change === null ? "--" : `${snapshot.change.toFixed(2)}%`} · 成交额 ${formatCompact(
        snapshot.quoteVolume,
      )}${snapshot.funding !== null ? ` · 资金费率 ${formatFunding(snapshot.funding)}` : ""}`
    : "";

  return (
    <main className="page" data-testid="studio-page">
      <PageHead
        eyebrow="MEME STUDIO / 行情卡片"
        title={
          <>
            把真实行情，<em>变成能传的图</em>
          </>
        }
        desc="卡片里的价格、涨跌幅、成交额与生成时间都来自实时行情快照，导出的是 PNG 原图，可以直接发到 X。"
        actions={
          <>
            <button type="button" className="btn" onClick={() => setSnapshot(captureSnapshot(market, symbol))}>
              <Icon name="refresh" size={13} /> 刷新数据
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={async () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ok = await exportCard(
                  canvas,
                  `crypto-radar-${snapshot?.base ?? "card"}-${Date.now()}.png`,
                );
                pushToast({
                  tone: ok ? "info" : "bad",
                  title: ok ? "PNG 已导出" : "导出失败",
                  text: ok ? "图片已下载到本地。" : "浏览器拒绝了导出，请重试。",
                });
              }}
              disabled={!snapshot}
            >
              <Icon name="download" size={13} /> 导出 PNG
            </button>
          </>
        }
      />

      {!snapshot ? (
        <Notice tone="warn">
          还没有可用的行情快照。请选择一个交易对，或等待行情源连接完成。
        </Notice>
      ) : null}

      <div className="studio">
        <Panel id="01" title="CARD EDITOR · 卡片设置" className="grow">
          <div className="studio__controls">
            <Field label="交易对">
              <button type="button" className="btn" onClick={() => setPickerOpen(true)}>
                <Icon name="search" size={12} />
                {symbol ? `${symbol} · ${MARKET_LABEL[market]}` : "选择交易对"}
              </button>
            </Field>

            <Field label="模板">
              <div className="tpl-grid">
                {TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="tpl-card"
                    data-active={template === item.id}
                    onClick={() => setTemplate(item.id)}
                  >
                    <span className="tpl-card__bar" />
                    <span className="tpl-card__name">{item.name}</span>
                    <span className="tpl-card__desc">{item.desc}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="标题（留空则不显示）">
              <input
                className="input"
                value={headline}
                maxLength={26}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder="例如：这根 K 线有点戏剧性"
              />
            </Field>

            <Field label="副标题 / 说明">
              <input
                className="input"
                value={caption}
                maxLength={70}
                onChange={(event) => setCaption(event.target.value)}
                placeholder={cap || "可选：补充一句你想说的话"}
              />
            </Field>

            <Field label="比例">
              <Seg
                value={ratio}
                onChange={setRatio}
                options={[
                  { value: "x", label: "1200 × 675 (X)" },
                  { value: "square", label: "1080 × 1080" },
                ]}
              />
            </Field>

            <Field label="展示字段">
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                <Switch checked={fields.price} onChange={(value) => setFields({ ...fields, price: value })} label="价格" />
                <Switch checked={fields.change} onChange={(value) => setFields({ ...fields, change: value })} label="涨跌幅" />
                <Switch checked={fields.volume} onChange={(value) => setFields({ ...fields, volume: value })} label="成交额" />
                <Switch checked={fields.spark} onChange={(value) => setFields({ ...fields, spark: value })} label="走势" />
              </div>
            </Field>

            <div className="mood__note">
              生成时间与数据来源会印在卡片底部，卡片不会被误认为实时报价。
            </div>

            <div className="row gap-6" style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn--sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    pushToast({ tone: "info", title: "分享链接已复制", text: "粘贴到 X 或聊天窗口即可。" });
                  } catch {
                    pushToast({ tone: "warn", title: "无法写入剪贴板", text: shareLink });
                  }
                }}
              >
                <Icon name="link" size={12} /> 复制分享链接
              </button>
              <Link className="btn btn--sm" to={`/charts?market=${market}&symbol=${encodeURIComponent(symbol)}`}>
                <Icon name="chart" size={12} /> 看 K 线
              </Link>
            </div>
          </div>
        </Panel>

        <Panel
          id="02"
          title="PREVIEW · 预览"
          hint={`${ratio === "x" ? "1200×675" : "1080×1080"} PNG`}
          footer={
            snapshot ? (
              <>
                <Icon name="clock" size={12} />
                <span>数据时间 {new Date(snapshot.dataTime).toLocaleString("zh-CN")}</span>
                <span className="toolbar__spacer" />
                <span>BINANCE PUBLIC API</span>
              </>
            ) : (
              <span>等待行情快照</span>
            )
          }
        >
          <div className="studio__stage">
            <canvas ref={canvasRef} className="studio__canvas" data-testid="meme-canvas" />
            <div className="studio__actions">
              <span className="dim" style={{ fontSize: 11 }}>
                {snapshot ? `${snapshot.symbol} · ${formatPrice(snapshot.price, snapshot.decimals)}` : "—"}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="选择交易对">
        <input
          className="input"
          autoFocus
          placeholder="搜索：BTC、ETH、SOL…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div style={{ marginTop: 10, display: "grid", gap: 2 }}>
          {candidates.map((row) =>
            row ? (
              <button
                key={row.key}
                type="button"
                className="search__row"
                onClick={() => {
                  setMarket(row.market);
                  setSymbol(row.symbol);
                  setQuery("");
                  setPickerOpen(false);
                }}
              >
                <span className="search__sym">{row.symbol}</span>
                <span className="search__mkt">{MARKET_LABEL[row.market]}</span>
                <span className="toolbar__spacer" />
                <span className="num dim" style={{ fontSize: 11 }}>
                  {formatPrice(row.price, row.decimals)}
                </span>
              </button>
            ) : null,
          )}
          {candidates.length === 0 ? <div className="search__empty">没有匹配的交易对</div> : null}
        </div>
      </Modal>

      <Panel id="03" title="版权与素材" plain>
        <div style={{ padding: 12, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.7 }}>
          卡片里的像素雷达眼睛、几何背景与字体排版都是本站原创绘制，没有使用任何第三方 Meme 图片素材。
          数据来源标注为 Binance 公开接口，导出图片用于分享时请保留底部的时间与来源信息。
        </div>
      </Panel>
    </main>
  );
}
