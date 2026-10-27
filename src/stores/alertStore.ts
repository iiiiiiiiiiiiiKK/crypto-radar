import { create } from "zustand";
import {
  createRule,
  loadAlerts,
  saveAlerts,
  type AlertDirection,
  type AlertRule,
} from "@/services/storage/alerts";
import type { MarketId } from "@/types/market";

interface AlertState {
  rules: AlertRule[];
  add: (market: MarketId, symbol: string, direction: AlertDirection, value: number) => string;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  markTriggered: (id: string, price: number) => void;
  reset: (id: string) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  rules: loadAlerts(),
  add: (market, symbol, direction, value) => {
    const rule = createRule(market, symbol, direction, value);
    const rules = [rule, ...get().rules];
    saveAlerts(rules);
    set({ rules });
    return rule.id;
  },
  remove: (id) => {
    const rules = get().rules.filter((rule) => rule.id !== id);
    saveAlerts(rules);
    set({ rules });
  },
  toggle: (id) => {
    const rules = get().rules.map((rule) =>
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule,
    );
    saveAlerts(rules);
    set({ rules });
  },
  markTriggered: (id, price) => {
    const rules = get().rules.map((rule) =>
      rule.id === id
        ? { ...rule, triggeredAt: Date.now(), triggeredPrice: price, enabled: false }
        : rule,
    );
    saveAlerts(rules);
    set({ rules });
  },
  reset: (id) => {
    const rules = get().rules.map((rule) =>
      rule.id === id
        ? { ...rule, triggeredAt: null, triggeredPrice: null, enabled: true }
        : rule,
    );
    saveAlerts(rules);
    set({ rules });
  },
}));
