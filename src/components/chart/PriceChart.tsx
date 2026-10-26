import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/types/market";

export interface ChartLine {
  id: string;
  label: string;
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
  /** Data points aligned to the candle timestamps. */
  points: { time: number; value: number }[];
}

export interface PriceChartProps {
  candles: Candle[];
  lines?: ChartLine[];
  volume?: boolean;
  height?: number;
  onCrosshair?: (candle: Candle | null) => void;
}

/**
 * Candlestick + volume chart built on TradingView's Lightweight Charts
 * (Apache-2.0). The chart instance is created once and updated in place so
 * that toggling an indicator never remounts the page.
 */
export function PriceChart({
  candles,
  lines = [],
  volume = true,
  height = 420,
  onCrosshair,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lineSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const linesRef = useRef<ChartLine[]>(lines);
  const [ready, setReady] = useState(false);

  linesRef.current = lines;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#0F1715" },
        textColor: "#8FA29A",
        fontSize: 11,
        fontFamily:
          '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Roboto Mono", monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(39,53,48,0.45)" },
        horzLines: { color: "rgba(39,53,48,0.45)" },
      },
      rightPriceScale: {
        borderColor: "#273530",
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: "#273530",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 6,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#5CCFC0", width: 1, style: 2, labelBackgroundColor: "#141F1C" },
        horzLine: { color: "#5CCFC0", width: 1, style: 2, labelBackgroundColor: "#141F1C" },
      },
      autoSize: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22C983",
      downColor: "#F05260",
      borderUpColor: "#22C983",
      borderDownColor: "#F05260",
      wickUpColor: "#22C983",
      wickDownColor: "#F05260",
      priceLineVisible: true,
      priceLineColor: "#B8F36B",
      lastValueVisible: true,
    });
    candleSeriesRef.current = candleSeries;

    if (volume) {
      const histogram = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
        borderVisible: false,
      });
      volumeSeriesRef.current = histogram;
    }

    chart.subscribeCrosshairMove((param) => {
      if (!onCrosshair) return;
      const data = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (!data || param.time === undefined) {
        onCrosshair(null);
        return;
      }
      const time = toMillis(param.time as number);
      const candle = candles.find((item) => item.time === time);
      onCrosshair(
        candle ?? {
          time,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: 0,
        },
      );
    });

    chartRef.current = chart;
    setReady(true);

    const lineSeries = lineSeriesRef.current;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lineSeries.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!ready || !series) return;
    series.setData(
      candles.map((candle) => ({
        time: (candle.time / 1000) as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );
    const histogram = volumeSeriesRef.current;
    if (histogram) {
      histogram.setData(
        candles.map((candle) => ({
          time: (candle.time / 1000) as UTCTimestamp,
          value: candle.volume,
          color:
            candle.close >= candle.open ? "rgba(34,201,131,0.32)" : "rgba(240,82,96,0.32)",
        })),
      );
    }
    chartRef.current?.timeScale().fitContent();
  }, [candles, ready]);

  useEffect(() => {
    if (!ready) return;
    const chart = chartRef.current;
    if (!chart) return;
    const existing = lineSeriesRef.current;

    for (const [id, series] of existing) {
      if (!lines.some((line) => line.id === id)) {
        chart.removeSeries(series);
        existing.delete(id);
      }
    }
    for (const line of lines) {
      let series = existing.get(line.id);
      if (!series) {
        series = chart.addLineSeries({
          color: line.color,
          lineWidth: line.lineWidth ?? 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        existing.set(line.id, series);
      } else {
        series.applyOptions({ color: line.color, lineWidth: line.lineWidth ?? 1 });
      }
      series.setData(
        line.points.map((point) => ({
          time: (point.time / 1000) as UTCTimestamp,
          value: point.value,
        })),
      );
    }
  }, [lines, ready]);

  return (
    <div ref={containerRef} className="w-full" style={{ height }} data-testid="price-chart" />
  );
}

function toMillis(time: UTCTimestamp | number): number {
  const numeric = Number(time);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 1e12 ? numeric : numeric * 1000;
}
