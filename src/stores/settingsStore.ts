import { create } from "zustand";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/services/storage/settings";
import type { AppSettings } from "@/services/storage/settings";
import type { ColumnVisibility, TableDensity } from "@/types/ui";
import type { Language } from "@/types/market";

interface SettingsState extends AppSettings {
  setLanguage: (language: Language) => void;
  setDensity: (density: TableDensity) => void;
  toggleColumn: (column: keyof ColumnVisibility) => void;
  setColumnOrder: (order: string[]) => void;
  setIndicator: (key: "ma" | "ema" | "rsi" | "macd", enabled: boolean) => void;
  setIndicatorParam: (key: "ma" | "ema" | "rsi", value: number) => void;
  setInterval: (interval: string) => void;
  setLastMarket: (market: string) => void;
  reset: () => void;
}

const persisted = loadSettings();

function persist(state: SettingsState): void {
  const snapshot: AppSettings = {
    language: state.language,
    density: state.density,
    columns: state.columns,
    visibleColumns: state.visibleColumns,
    columnOrder: state.columnOrder,
    indicators: state.indicators,
    indicatorParams: state.indicatorParams,
    interval: state.interval,
    lastMarket: state.lastMarket,
  };
  saveSettings(snapshot);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...persisted,
  setLanguage: (language) => {
    set({ language });
    persist(get());
  },
  setDensity: (density) => {
    set({ density });
    persist(get());
  },
  toggleColumn: (column) => {
    set((state) => {
      const columns = { ...state.columns, [column]: !state.columns[column] };
      const visibleColumns = state.visibleColumns.filter((c) => c !== column);
      if (columns[column]) visibleColumns.push(column);
      const next = { ...state, columns, visibleColumns };
      persist(next);
      return { columns, visibleColumns };
    });
  },
  setColumnOrder: (columnOrder) => {
    set({ columnOrder });
    persist(get());
  },
  setIndicator: (key, enabled) => {
    set((state) => {
      const indicators = { ...state.indicators, [key]: enabled };
      const next = { ...state, indicators };
      persist(next);
      return { indicators };
    });
  },
  setIndicatorParam: (key, value) => {
    set((state) => {
      const indicatorParams = { ...state.indicatorParams, [key]: value };
      const next = { ...state, indicatorParams };
      persist(next);
      return { indicatorParams };
    });
  },
  setInterval: (interval) => {
    set({ interval });
    persist(get());
  },
  setLastMarket: (lastMarket) => {
    set({ lastMarket });
    persist(get());
  },
  reset: () => {
    set({ ...DEFAULT_SETTINGS });
    persist(get());
  },
}));
