import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { useOwnMarketData } from "@/hooks/useOwnMarketData";
import { useMarketStore } from "@/stores/marketStore";
import { getAdapter } from "@/services/binance";
import { CANVAS_SIZE, downloadMeme, renderMeme, type StudioRatio, type StudioTheme } from "./renderMeme";
import type { Candle } from "@/types/market";

const THEMES: StudioTheme[] = ["pixel", "comic", "terminal"];
const RATIOS: StudioRatio[] = ["x", "square"];

/**
 * Meme Studio.
 *
 * The preview is a real canvas produced by `renderMeme`, and the export is the
 * exact same canvas encoded as PNG, so what the user sees is what they save.
 * The card always carries the timestamp of the data it was drawn from.
 */
export function StudioPage() {
  const { t } = useI18n();
  const { tickers, loading: loadingMarket } = useOwnMarketData();
  const market = useMarketStore((state) => state.market);

  const [symbol, setSymbol] = useState("");
  const [theme, setTheme] = useState<StudioTheme>("pixel");
  const [ratio, setRatio] = useState<StudioRatio>("x");
  const [headline, setHeadline] = useState("");
  const [caption, setCaption] = useState("");
  const [includeChart, setIncludeChart] = useState(true);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [dataTime, setDataTime] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const ticker = useMemo(
    () => tickers.find((item) => item.symbol === symbol) ?? null,
    [tickers, symbol],
  );

  useEffect(() => {
    if (!symbol && tickers.length > 0) {
      const preferred = tickers.find((item) => item.symbol === "BTCUSDT") ?? tickers[0];
      setSymbol(preferred.symbol);
    }
  }, [tickers, symbol]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoadingCandles(true);
    getAdapter(market)
      .listKlines(symbol, "1h", 48)
      .then((data) => {
        if (!cancelled) setCandles(data);
      })
      .catch(() => {
        if (!cancelled) setCandles([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCandles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, market]);

  const render = useCallback(() => {
    if (!ticker) return;
    setRendering(true);
    const stamp = Date.now();
    // Let the browser paint the "rendering" state before the synchronous draw.
    requestAnimationFrame(() => {
      const canvas = renderMeme({
        ticker,
        candles,
        theme,
        ratio,
        headline: headline || `${ticker.symbol} ${ticker.priceChangePercent >= 0 ? "is up" : "is down"}`,
        caption,
        marketLabel: t(`market.${market}`),
        dataTime: stamp,
        includeChart,
      });
      canvas.className = "max-w-full h-auto block";
      canvas.style.width = "100%";
      canvas.dataset.testid = "meme-canvas";
      const host = previewRef.current;
      if (host) {
        host.replaceChildren(canvas);
      }
      canvasRef.current = canvas;
      setDataTime(stamp);
      setRendering(false);
    });
  }, [ticker, candles, theme, ratio, headline, caption, market, includeChart, t]);

  useEffect(() => {
    if (!ticker) return;
    const timer = setTimeout(render, 120);
    return () => clearTimeout(timer);
  }, [render, ticker]);

  const exportPng = async () => {
    if (!canvasRef.current || !ticker) return;
    await downloadMeme(
      canvasRef.current,
      `crypto-radar-${ticker.symbol}-${Date.now()}.png`,
    );
  };

  const size = CANVAS_SIZE[ratio];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto cr-scroll">
      <div className="max-w-6xl mx-auto p-2 sm:p-4 flex flex-col gap-3">
        <header className="flex flex-wrap items-baseline gap-2">
          <h1 className="pixel-title text-sm">{t("studio.title")}</h1>
          <p className="text-2xs text-faint">{t("studio.subtitle")}</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 items-start">
          {/* controls */}
          <section className="cr-panel p-3 flex flex-col gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("studio.symbol")}</span>
              <input
                className="cr-input cr-mono"
                list="studio-symbols"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                data-testid="studio-symbol"
              />
              <datalist id="studio-symbols">
                {tickers.slice(0, 300).map((item) => (
                  <option key={item.symbol} value={item.symbol} />
                ))}
              </datalist>
            </label>

            <div className="flex flex-col gap-1">
              <span className="cr-label">{t("studio.theme")}</span>
              <div className="flex items-center gap-1">
                {THEMES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`cr-tab flex-1 justify-center ${theme === item ? "cr-tab-active" : ""}`}
                    onClick={() => setTheme(item)}
                    data-testid={`studio-theme-${item}`}
                  >
                    {t(`studio.theme${item === "pixel" ? "Pixel" : item === "comic" ? "Comic" : "Terminal"}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="cr-label">{t("studio.ratio")}</span>
              <div className="flex items-center gap-1">
                {RATIOS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`cr-tab flex-1 justify-center ${ratio === item ? "cr-tab-active" : ""}`}
                    onClick={() => setRatio(item)}
                    data-testid={`studio-ratio-${item}`}
                  >
                    {item === "x" ? t("studio.ratioX") : t("studio.ratioSquare")}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("studio.headline")}</span>
              <input
                className="cr-input"
                value={headline}
                maxLength={40}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder="TO THE MOON?"
                data-testid="studio-headline"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("studio.caption")}</span>
              <textarea
                className="cr-input h-16 py-1 resize-none"
                value={caption}
                maxLength={120}
                onChange={(event) => setCaption(event.target.value)}
                placeholder={t("studio.caption")}
                data-testid="studio-caption"
              />
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="accent-[#39ff88] w-4 h-4"
                checked={includeChart}
                onChange={(event) => setIncludeChart(event.target.checked)}
                data-testid="studio-chart"
              />
              {t("studio.includeChart")}
              {loadingCandles ? <span className="text-2xs text-faint">…</span> : null}
            </label>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className="cr-btn cr-btn-primary flex-1"
                onClick={() => void exportPng()}
                disabled={!ticker || rendering}
                data-testid="studio-download"
              >
                {rendering ? t("studio.generating") : t("studio.download")}
              </button>
              <button type="button" className="cr-btn" onClick={render} disabled={!ticker}>
                ⟳
              </button>
            </div>

            <p className="text-2xs text-faint leading-relaxed">{t("studio.disclaimer")}</p>
          </section>

          {/* preview */}
          <section className="cr-panel p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="cr-label">{t("studio.preview")}</span>
              <span className="cr-mono text-2xs text-faint">
                {size.width}×{size.height}
              </span>
              {dataTime ? (
                <span className="cr-mono text-2xs text-faint ml-auto" data-testid="studio-datatime">
                  {t("studio.dataTime")} {new Date(dataTime).toLocaleTimeString("en-GB", { hour12: false })}
                </span>
              ) : null}
            </div>
            <div ref={previewRef} className="w-full overflow-hidden bg-bg-2" />
            {!ticker ? (
              <div className="py-10 flex justify-center">
                {loadingMarket || tickers.length === 0 ? (
                  <Spinner label={t("market.loading")} />
                ) : (
                  <span className="text-2xs text-faint">{t("studio.needSymbol")}</span>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
