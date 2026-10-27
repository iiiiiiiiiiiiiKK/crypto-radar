import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type UTCTimestamp,
} from "lightweight-charts";

export interface SubSeries {
  id: string;
  type: "line" | "histogram";
  color: string;
  points: { time: number; value: number }[];
}

export interface SubChartProps {
  title: string;
  series: SubSeries[];
  height: number;
  /** The main chart, used for time scale synchronisation. */
  main: IChartApi | null;
  /** Optional horizontal guide lines (e.g. 30/70 for RSI). */
  guides?: number[];
  valueLabel?: string;
}

/**
 * A secondary pane (RSI, MACD) with its own price scale.
 *
 * The indicators must never share the price scale of the candlesticks: an
 * RSI between 0 and 100 on a price axis would squash the candles into a flat
 * line. Each pane therefore owns its chart and only the time scale is synced.
 */
export function SubChart({ title, series, height, main, guides = [], valueLabel }: SubChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#0e1018" },
        textColor: "#7d879e",
        fontSize: 10,
        fontFamily: '"JetBrains Mono", Menlo, Consolas, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(35,42,61,0.5)" },
        horzLines: { color: "rgba(35,42,61,0.5)" },
      },
      rightPriceScale: {
        borderColor: "#232a3d",
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: { borderColor: "#232a3d", visible: false, rightOffset: 4 },
      crosshair: {
        vertLine: { color: "#39ff88", width: 1, style: 2, labelBackgroundColor: "#141826" },
        horzLine: { color: "#39ff88", width: 1, style: 2, labelBackgroundColor: "#141826" },
      },
      handleScale: false,
      handleScroll: false,
      autoSize: true,
    });
    chartRef.current = chart;

    for (const guide of guides) {
      const line = chart.addLineSeries({
        color: "rgba(125,135,158,0.35)",
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(
        (series[0]?.points ?? []).map((point) => ({
          time: (point.time / 1000) as UTCTimestamp,
          value: guide,
        })),
      );
    }

    const seriesApi = seriesRef.current;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesApi.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guides.join(",")]);

  // Data
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const existing = seriesRef.current;

    for (const [id, api] of existing) {
      if (!series.some((item) => item.id === id)) {
        chart.removeSeries(api);
        existing.delete(id);
      }
    }

    for (const item of series) {
      let api = existing.get(item.id);
      if (!api) {
        api =
          item.type === "histogram"
            ? chart.addHistogramSeries({ color: item.color, priceLineVisible: false, lastValueVisible: false })
            : chart.addLineSeries({
                color: item.color,
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
              });
        existing.set(item.id, api);
      } else {
        api.applyOptions({ color: item.color });
      }
      if (item.type === "histogram") {
        (api as ISeriesApi<"Histogram">).setData(
          item.points.map((point) => ({
            time: (point.time / 1000) as UTCTimestamp,
            value: point.value,
            color: point.value >= 0 ? "rgba(57,255,136,0.55)" : "rgba(255,59,107,0.55)",
          })),
        );
      } else {
        (api as ISeriesApi<"Line">).setData(
          item.points.map((point) => ({
            time: (point.time / 1000) as UTCTimestamp,
            value: point.value,
          })),
        );
      }
    }
  }, [series]);

  // Time scale sync with the main chart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !main) return;

    let syncing = false;
    const apply = (range: LogicalRange | null) => {
      if (!range || syncing) return;
      syncing = true;
      chart.timeScale().setVisibleLogicalRange(range);
      syncing = false;
    };

    const current = main.timeScale().getVisibleLogicalRange();
    if (current) chart.timeScale().setVisibleLogicalRange(current);

    main.timeScale().subscribeVisibleLogicalRangeChange(apply);
    return () => {
      main.timeScale().unsubscribeVisibleLogicalRangeChange(apply);
    };
  }, [main]);

  return (
    <div className="cr-panel relative overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-0.5 border-b border-line-soft">
        <span className="pixel-label">{title}</span>
        {valueLabel ? <span className="cr-mono text-2xs text-faint">{valueLabel}</span> : null}
      </div>
      <div ref={containerRef} style={{ height }} data-testid={`subchart-${title.toLowerCase()}`} />
    </div>
  );
}
