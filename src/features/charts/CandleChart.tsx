import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { KlineStream } from "@/services/ws/klineStream";
import { getAdapter } from "@/services";
import { describeError } from "@/services/http";
import { formatPrice } from "@/lib/format";
import type { Candle, Interval } from "@/types/market";
import type { IndicatorPrefs } from "@/stores/preferences";
import { bollinger, ema, macd, rsi, sma, toLinePoints } from "./indicators";

export type ChartPhase = "loading" | "ready" | "error" | "unavailable";
export interface ChartStatus {
  phase: ChartPhase;
  error: string | null;
  /** Websocket state of the live candle stream. */
  live: "connecting" | "live" | "offline";
  lastCandleAt: number | null;
  bars: number;
}

interface Props {
  market: "spot" | "futures" | "alpha";
  symbol: string;
  interval: Interval;
  decimals: number;
  indicators: IndicatorPrefs;
  periods: { ma1: number; ma2: number; ema: number; boll: number; rsi: number };
  onStatus?: (status: ChartStatus) => void;
}

const COLORS = {
  up: "#00f5a0",
  down: "#ff4d67",
  bg: "#080c11",
  grid: "rgba(26,35,45,0.65)",
  text: "#7b8b99",
  ma1: "#ffd166",
  ma2: "#55b8ff",
  ema: "#b18cff",
  boll: "rgba(85,184,255,0.75)",
  bollFill: "rgba(85,184,255,0.06)",
  rsi: "#b18cff",
  macd: "#55b8ff",
  signal: "#ffd166",
};

const MONO = '"Cascadia Mono", "SF Mono", Consolas, monospace';

function baseOptions(height: number, decimals: number) {
  return {
    height,
    layout: {
      background: { type: ColorType.Solid, color: COLORS.bg },
      textColor: COLORS.text,
      fontFamily: MONO,
      fontSize: 10,
    },
    grid: {
      vertLines: { color: COLORS.grid },
      horzLines: { color: COLORS.grid },
    },
    rightPriceScale: { borderColor: "#1a232d", scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: "#1a232d", timeVisible: true, secondsVisible: false, rightOffset: 3 },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: "#3b4b5a", width: 1 as const, labelBackgroundColor: "#16202a" },
      horzLine: { color: "#3b4b5a", width: 1 as const, labelBackgroundColor: "#16202a" },
    },
    localization: { priceFormatter: (value: number) => formatPrice(value, decimals) },
  };
}

/**
 * Candlestick chart with volume, overlay indicators and two synced sub panes.
 *
 * The component owns the chart instances imperatively: websocket ticks call
 * `series.update()` instead of re-rendering React, which keeps a 1 s stream
 * from thrashing the component tree.
 */
export function CandleChart({
  market,
  symbol,
  interval,
  decimals,
  indicators,
  periods,
  onStatus,
}: Props) {
  const mainHost = useRef<HTMLDivElement>(null);
  const rsiHost = useRef<HTMLDivElement>(null);
  const macdHost = useRef<HTMLDivElement>(null);

  const charts = useRef<{
    main: IChartApi | null;
    rsi: IChartApi | null;
    macd: IChartApi | null;
  }>({ main: null, rsi: null, macd: null });

  const series = useRef<{
    candle: ISeriesApi<"Candlestick"> | null;
    volume: ISeriesApi<"Histogram"> | null;
    ma1: ISeriesApi<"Line"> | null;
    ma2: ISeriesApi<"Line"> | null;
    ema: ISeriesApi<"Line"> | null;
    bollUpper: ISeriesApi<"Line"> | null;
    bollMiddle: ISeriesApi<"Line"> | null;
    bollLower: ISeriesApi<"Line"> | null;
    rsi: ISeriesApi<"Line"> | null;
    macd: ISeriesApi<"Line"> | null;
    signal: ISeriesApi<"Line"> | null;
    histogram: ISeriesApi<"Histogram"> | null;
  }>({
    candle: null,
    volume: null,
    ma1: null,
    ma2: null,
    ema: null,
    bollUpper: null,
    bollMiddle: null,
    bollLower: null,
    rsi: null,
    macd: null,
    signal: null,
    histogram: null,
  });

  const candles = useRef<Candle[]>([]);
  const stream = useRef<KlineStream | null>(null);
  const loadToken = useRef(0);
  const syncing = useRef(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [phase, setPhase] = useState<ChartPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<ChartStatus["live"]>("connecting");
  const [lastCandle, setLastCandle] = useState<Candle | null>(null);
  const [bars, setBars] = useState(0);

  /* ------------------------------------------------------------- chart init */
  useEffect(() => {
    if (!mainHost.current || !rsiHost.current || !macdHost.current) return;

    const main = createChart(mainHost.current, { ...baseOptions(mainHost.current.clientHeight || 420, decimals) });
    const candle = main.addCandlestickSeries({
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderUpColor: COLORS.up,
      borderDownColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      priceLineColor: "#94a3b8",
      priceLineStyle: 2,
    });
    const volume = main.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    main.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const line = (color: string, width: 1 | 2 = 1) =>
      main.addLineSeries({
        color,
        lineWidth: width,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

    const ma1 = line(COLORS.ma1);
    const ma2 = line(COLORS.ma2);
    const emaSeries = line(COLORS.ema);
    const bollUpper = line(COLORS.boll);
    const bollMiddle = line(COLORS.boll);
    const bollLower = line(COLORS.boll);

    const rsiChart = createChart(rsiHost.current, {
      ...baseOptions(rsiHost.current.clientHeight || 110, 2),
      rightPriceScale: {
        borderColor: "#1a232d",
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
    });
    const rsiSeries = rsiChart.addLineSeries({
      color: COLORS.rsi,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const macdChart = createChart(macdHost.current, {
      ...baseOptions(macdHost.current.clientHeight || 120, 4),
    });
    const macdSeries = macdChart.addLineSeries({
      color: COLORS.macd,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const signalSeries = macdChart.addLineSeries({
      color: COLORS.signal,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const histogramSeries = macdChart.addHistogramSeries({
      priceLineVisible: false,
      lastValueVisible: false,
    });

    charts.current = { main, rsi: rsiChart, macd: macdChart };
    series.current = {
      candle,
      volume,
      ma1,
      ma2,
      ema: emaSeries,
      bollUpper,
      bollMiddle,
      bollLower,
      rsi: rsiSeries,
      macd: macdSeries,
      signal: signalSeries,
      histogram: histogramSeries,
    };

    // Keep the three panes scrolled/panned together.
    const sync = (from: IChartApi, to: IChartApi[]) => {
      from.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (!range || syncing.current) return;
        syncing.current = true;
        for (const target of to) target.timeScale().setVisibleLogicalRange(range);
        syncing.current = false;
      });
    };
    sync(main, [rsiChart, macdChart]);
    sync(rsiChart, [main, macdChart]);
    sync(macdChart, [main, rsiChart]);

    const observer = new ResizeObserver(() => {
      if (mainHost.current) {
        main.applyOptions({ width: mainHost.current.clientWidth, height: mainHost.current.clientHeight });
      }
      if (rsiHost.current) {
        rsiChart.applyOptions({ width: rsiHost.current.clientWidth, height: rsiHost.current.clientHeight });
      }
      if (macdHost.current) {
        macdChart.applyOptions({
          width: macdHost.current.clientWidth,
          height: macdHost.current.clientHeight,
        });
      }
    });
    if (mainHost.current) observer.observe(mainHost.current);
    if (rsiHost.current) observer.observe(rsiHost.current);
    if (macdHost.current) observer.observe(macdHost.current);

    return () => {
      observer.disconnect();
      main.remove();
      rsiChart.remove();
      macdChart.remove();
      charts.current = { main: null, rsi: null, macd: null };
      series.current = {
        candle: null,
        volume: null,
        ma1: null,
        ma2: null,
        ema: null,
        bollUpper: null,
        bollMiddle: null,
        bollLower: null,
        rsi: null,
        macd: null,
        signal: null,
        histogram: null,
      };
    };
    // Chart instances are created once; data flows in through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------- data loading */
  useEffect(() => {
    const token = ++loadToken.current;
    candles.current = [];
    setPhase("loading");
    setError(null);
    setLive("connecting");
    series.current.candle?.setData([]);
    series.current.volume?.setData([]);

    if (market === "alpha") {
      setPhase("unavailable");
      setError("Alpha 没有公开的 K 线接口，无法绘制蜡烛图。");
      setLive("offline");
      return;
    }

    let cancelled = false;
    const adapter = getAdapter(market);

    adapter
      .fetchKlines(symbol, interval, 500)
      .then((data) => {
        if (cancelled || token !== loadToken.current) return;
        candles.current = data;
        applySeries();
        setPhase(data.length === 0 ? "error" : "ready");
        setLastCandle(data.at(-1) ?? null);
        setBars(data.length);
        if (data.length === 0) setError("交易对没有返回任何 K 线数据。");
        setDataVersion((version) => version + 1);
      })
      .catch((cause: unknown) => {
        if (cancelled || token !== loadToken.current) return;
        setPhase("error");
        setError(describeError(cause));
      });

    // Live candle updates for this exact symbol + interval.
    const live_ = new KlineStream(market, (state) => {
      if (token !== loadToken.current) return;
      setLive(state === "reconnecting" ? "connecting" : state);
    });
    stream.current = live_;
    live_.open(symbol, interval, ({ candle }) => {
      if (token !== loadToken.current) return;
      const current = candles.current;
      const last = current[current.length - 1];
      if (!last) return;
      if (candle.time === last.time) current[current.length - 1] = candle;
      else if (candle.time > last.time) current.push(candle);
      else {
        const index = current.findIndex((item) => item.time === candle.time);
        if (index >= 0) current[index] = candle;
        else return;
      }
      paintCandle(candle);
      setLive("live");
      setLastCandle(candle);
    });

    return () => {
      cancelled = true;
      stream.current?.close();
      stream.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, symbol, interval]);

  /* ------------------------------------------------------------ paint logic */

  function toCandleData(candle: Candle): CandlestickData {
    return {
      time: Math.floor(candle.time / 1000) as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    };
  }

  function toVolumeData(candle: Candle): HistogramData {
    return {
      time: Math.floor(candle.time / 1000) as UTCTimestamp,
      value: candle.volume,
      color: candle.close >= candle.open ? "rgba(0,245,160,0.35)" : "rgba(255,77,103,0.35)",
    };
  }

  function paintCandle(candle: Candle) {
    series.current.candle?.update(toCandleData(candle));
    series.current.volume?.update(toVolumeData(candle));
  }

  function applySeries() {
    const data = candles.current;
    series.current.candle?.setData(data.map(toCandleData));
    series.current.volume?.setData(data.map(toVolumeData));
    applyIndicators(data);
    charts.current.main?.timeScale().fitContent();
  }

  function applyIndicators(data: Candle[]) {
    const times = data.map((candle) => Math.floor(candle.time / 1000));
    const closes = data.map((candle) => candle.close);
    const toData = (values: Array<number | null>): LineData[] =>
      toLinePoints(times, values).map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      }));

    series.current.ma1?.setData(indicators.ma ? toData(sma(closes, periods.ma1)) : []);
    series.current.ma2?.setData(indicators.ma ? toData(sma(closes, periods.ma2)) : []);
    series.current.ema?.setData(indicators.ema ? toData(ema(closes, periods.ema)) : []);

    if (indicators.boll) {
      const bands = bollinger(closes, periods.boll, 2);
      series.current.bollUpper?.setData(toData(bands.upper));
      series.current.bollMiddle?.setData(toData(bands.middle));
      series.current.bollLower?.setData(toData(bands.lower));
    } else {
      series.current.bollUpper?.setData([]);
      series.current.bollMiddle?.setData([]);
      series.current.bollLower?.setData([]);
    }

    series.current.rsi?.setData(indicators.rsi ? toData(rsi(closes, periods.rsi)) : []);
    if (indicators.macd) {
      const result = macd(closes);
      series.current.macd?.setData(toData(result.macd));
      series.current.signal?.setData(toData(result.signal));
      const histTimes = times;
      const histogram: HistogramData[] = [];
      result.histogram.forEach((value, index) => {
        if (value === null || !Number.isFinite(value)) return;
        histogram.push({
          time: histTimes[index] as UTCTimestamp,
          value,
          color: value >= 0 ? "rgba(0,245,160,0.5)" : "rgba(255,77,103,0.5)",
        });
      });
      series.current.histogram?.setData(histogram);
    } else {
      series.current.macd?.setData([]);
      series.current.signal?.setData([]);
      series.current.histogram?.setData([]);
    }
  }

  // Indicator toggles / period changes recompute from the cached candles.
  useEffect(() => {
    if (candles.current.length === 0) return;
    applyIndicators(candles.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators, periods, dataVersion]);

  useEffect(() => {
    onStatus?.({ phase, error, live, lastCandleAt: lastCandle?.time ?? null, bars });
  }, [phase, error, live, lastCandle, bars, onStatus]);

  const legendRow = (label: string, value: number | undefined, tone?: "up" | "down") => (
    <span>
      {label}{" "}
      <b className={`num ${tone ?? ""}`} style={{ fontWeight: 500 }}>
        {formatPrice(value ?? null, decimals)}
      </b>
    </span>
  );

  return (
    <div className="chartstack" data-testid="chart-stack">
      <div className="chartpane chartpane--main">
        <div className="chartpane__legend">
          {lastCandle
            ? [
                legendRow("O", lastCandle.open),
                legendRow("H", lastCandle.high),
                legendRow("L", lastCandle.low),
                legendRow(
                  "C",
                  lastCandle.close,
                  lastCandle.close >= lastCandle.open ? "up" : "down",
                ),
              ]
            : null}
          {indicators.ma ? (
            <span style={{ color: COLORS.ma1 }}>MA{periods.ma1}</span>
          ) : null}
          {indicators.ma ? <span style={{ color: COLORS.ma2 }}>MA{periods.ma2}</span> : null}
          {indicators.ema ? <span style={{ color: COLORS.ema }}>EMA{periods.ema}</span> : null}
          {indicators.boll ? <span style={{ color: COLORS.boll }}>BOLL{periods.boll}</span> : null}
        </div>
        <div className="chartpane__canvas" ref={mainHost} />
      </div>

      <div
        className="chartpane chartpane--sub"
        style={{ height: indicators.rsi ? 108 : 0, display: indicators.rsi ? "block" : "none" }}
      >
        <div className="chartpane__legend">
          <span>RSI({periods.rsi})</span>
        </div>
        <div className="chartpane__canvas" ref={rsiHost} />
      </div>

      <div
        className="chartpane chartpane--sub"
        style={{ height: indicators.macd ? 122 : 0, display: indicators.macd ? "block" : "none" }}
      >
        <div className="chartpane__legend">
          <span>MACD(12,26,9)</span>
        </div>
        <div className="chartpane__canvas" ref={macdHost} />
      </div>
    </div>
  );
}
