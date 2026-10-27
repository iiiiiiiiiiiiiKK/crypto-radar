import { safeStorage } from "./safeStorage";
import type { ColumnVisibility, TableDensity } from "@/types/ui";
import type { Language } from "@/types/market";

const STORAGE_KEY = "crypto-radar:settings:v1";

export type HomeView = "arena" | "table" | "heatmap";
export type ThemeId = "neon" | "voltage" | "alarm";

export interface AppSettings {
  language: Language;
  density: TableDensity;
  columns: ColumnVisibility;
  visibleColumns: string[];
  columnOrder: string[];
  indicators: {
    ma: boolean;
    ema: boolean;
    rsi: boolean;
    macd: boolean;
  };
  indicatorParams: {
    ma: number;
    ema: number;
    rsi: number;
  };
  interval: string;
  lastMarket: string;
  /** Default presentation of the home screen. */
  homeView: HomeView;
  /** Accent theme. */
  theme: ThemeId;
  /** Pixel avatar id used on the trader base. */
  avatar: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "zh",
  density: "compact",
  columns: {
    price: true,
    change: false,
    changePercent: true,
    high: true,
    low: true,
    volume: true,
    quoteVolume: true,
    bidAsk: false,
    markPrice: true,
    fundingRate: true,
    openInterest: false,
    updatedAt: true,
  },
  visibleColumns: [
    "price",
    "changePercent",
    "range",
    "volume",
    "quoteVolume",
    "markPrice",
    "fundingRate",
    "updatedAt",
  ],
  columnOrder: [
    "symbol",
    "price",
    "changePercent",
    "range",
    "high",
    "low",
    "volume",
    "quoteVolume",
    "bidAsk",
    "markPrice",
    "fundingRate",
    "openInterest",
    "updatedAt",
  ],
  indicators: { ma: true, ema: false, rsi: true, macd: false },
  indicatorParams: { ma: 7, ema: 25, rsi: 14 },
  interval: "15m",
  lastMarket: "spot",
  homeView: "arena",
  theme: "neon",
  avatar: "radar",
};

export function loadSettings(): AppSettings {
  const raw = safeStorage.get<unknown>(STORAGE_KEY, null);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const value = raw as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    columns: { ...DEFAULT_SETTINGS.columns, ...(value.columns ?? {}) },
    indicators: { ...DEFAULT_SETTINGS.indicators, ...(value.indicators ?? {}) },
    indicatorParams: { ...DEFAULT_SETTINGS.indicatorParams, ...(value.indicatorParams ?? {}) },
    visibleColumns: Array.isArray(value.visibleColumns)
      ? value.visibleColumns
      : DEFAULT_SETTINGS.visibleColumns,
    columnOrder: Array.isArray(value.columnOrder)
      ? value.columnOrder
      : DEFAULT_SETTINGS.columnOrder,
    homeView:
      value.homeView === "table" || value.homeView === "heatmap" || value.homeView === "arena"
        ? value.homeView
        : DEFAULT_SETTINGS.homeView,
    theme:
      value.theme === "voltage" || value.theme === "alarm" || value.theme === "neon"
        ? value.theme
        : DEFAULT_SETTINGS.theme,
    avatar: typeof value.avatar === "string" ? value.avatar : DEFAULT_SETTINGS.avatar,
  };
}

export function saveSettings(settings: AppSettings): boolean {
  return safeStorage.set(STORAGE_KEY, settings);
}
