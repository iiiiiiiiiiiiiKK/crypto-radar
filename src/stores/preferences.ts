import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Interval, MarketId } from "@/types/market";
import { DEFAULT_EVENT_THRESHOLDS, type EventThresholds } from "@/engine/events";
import { DEFAULT_SCAN_RULE, type ScanRule } from "@/engine/scanner";

export type Density = "compact" | "normal" | "comfy";
export type ChartRails = "both" | "left" | "right" | "none";
export type ChangePreset = "all" | "up5" | "down5" | "hot";

/** Saved filter state of the market table (the "saved screener" of the desk). */
export interface MarketsFilter {
  changePreset: ChangePreset;
  minTurnover: number;
  onlyWatch: boolean;
  sortId: string;
  sortDir: "asc" | "desc";
}

export interface IndicatorPrefs {
  ma: boolean;
  ema: boolean;
  boll: boolean;
  rsi: boolean;
  macd: boolean;
  volume: boolean;
}

export interface PreferencesState {
  market: MarketId;
  quoteFilter: "USDT" | "all" | "BTC" | "USDC" | "FDUSD";
  lastSymbol: Record<MarketId, string>;
  interval: Interval;
  indicators: IndicatorPrefs;
  maPeriods: { ma1: number; ma2: number; ema: number; boll: number; rsi: number };
  density: Density;
  chartRails: ChartRails;
  showMemeCopy: boolean;
  motion: "full" | "calm";
  columns: string[];
  marketsFilter: MarketsFilter;
  radarRule: ScanRule;
  eventThresholds: EventThresholds;
  eventsEnabled: boolean;
  setMarket: (market: MarketId) => void;
  setQuoteFilter: (quote: PreferencesState["quoteFilter"]) => void;
  setSymbol: (market: MarketId, symbol: string) => void;
  setInterval: (interval: Interval) => void;
  toggleIndicator: (key: keyof IndicatorPrefs) => void;
  setMaPeriod: (key: keyof PreferencesState["maPeriods"], value: number) => void;
  setDensity: (density: Density) => void;
  setChartRails: (rails: ChartRails) => void;
  setColumns: (columns: string[]) => void;
  setMarketsFilter: (patch: Partial<MarketsFilter>) => void;
  setMotion: (motion: "full" | "calm") => void;
  setShowMemeCopy: (value: boolean) => void;
  setRadarRule: (rule: ScanRule) => void;
  setEventThresholds: (thresholds: EventThresholds) => void;
  setEventsEnabled: (value: boolean) => void;
  resetPreferences: () => void;
}

export const DEFAULT_COLUMNS = [
  "price",
  "change",
  "m5",
  "volumeSurge",
  "high",
  "low",
  "quoteVolume",
  "funding",
  "openInterest",
];

const DEFAULTS = {
  market: "spot" as MarketId,
  quoteFilter: "USDT" as const,
  lastSymbol: { spot: "BTCUSDT", futures: "BTCUSDT", alpha: "" } as Record<MarketId, string>,
  interval: "15m" as Interval,
  indicators: { ma: true, ema: false, boll: false, rsi: false, macd: false, volume: true },
  maPeriods: { ma1: 7, ma2: 25, ema: 21, boll: 20, rsi: 14 },
  density: "normal" as Density,
  chartRails: "both" as ChartRails,
  showMemeCopy: true,
  motion: "full" as const,
  columns: DEFAULT_COLUMNS,
  marketsFilter: {
    changePreset: "all",
    minTurnover: 0,
    onlyWatch: false,
    sortId: "quoteVolume",
    sortDir: "desc",
  } as MarketsFilter,
  radarRule: DEFAULT_SCAN_RULE,
  eventThresholds: DEFAULT_EVENT_THRESHOLDS,
  eventsEnabled: true,
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setMarket: (market) => set({ market }),
      setQuoteFilter: (quoteFilter) => set({ quoteFilter }),
      setSymbol: (market, symbol) =>
        set((state) => ({ lastSymbol: { ...state.lastSymbol, [market]: symbol } })),
      setInterval: (interval) => set({ interval }),
      toggleIndicator: (key) =>
        set((state) => ({ indicators: { ...state.indicators, [key]: !state.indicators[key] } })),
      setMaPeriod: (key, value) =>
        set((state) => ({ maPeriods: { ...state.maPeriods, [key]: value } })),
      setDensity: (density) => set({ density }),
      setChartRails: (chartRails) => set({ chartRails }),
      setColumns: (columns) => set({ columns }),
      setMarketsFilter: (patch) =>
        set((state) => ({ marketsFilter: { ...state.marketsFilter, ...patch } })),
      setMotion: (motion) => set({ motion }),
      setShowMemeCopy: (showMemeCopy) => set({ showMemeCopy }),
      setRadarRule: (radarRule) => set({ radarRule }),
      setEventThresholds: (eventThresholds) => set({ eventThresholds }),
      setEventsEnabled: (eventsEnabled) => set({ eventsEnabled }),
      resetPreferences: () => set({ ...DEFAULTS }),
    }),
    {
      name: "crypto-radar:v2:prefs",
      version: 2,
      partialize: (state) => ({
        market: state.market,
        quoteFilter: state.quoteFilter,
        lastSymbol: state.lastSymbol,
        interval: state.interval,
        indicators: state.indicators,
        maPeriods: state.maPeriods,
        density: state.density,
        chartRails: state.chartRails,
        showMemeCopy: state.showMemeCopy,
        motion: state.motion,
        columns: state.columns,
        marketsFilter: state.marketsFilter,
        radarRule: state.radarRule,
        eventThresholds: state.eventThresholds,
        eventsEnabled: state.eventsEnabled,
      }),
    },
  ),
);

export const DENSITY_ROW: Record<Density, number> = {
  compact: 28,
  normal: 34,
  comfy: 40,
};
