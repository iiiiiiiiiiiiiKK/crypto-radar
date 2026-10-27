import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MarketId } from "@/types/market";
import { createId } from "@/lib/storage";

export type AlertDirection = "above" | "below";

export interface PriceAlert {
  id: string;
  key: string;
  market: MarketId;
  symbol: string;
  direction: AlertDirection;
  price: number;
  enabled: boolean;
  createdAt: number;
  lastFiredAt: number | null;
}

interface AlertsState {
  alerts: PriceAlert[];
  add: (alert: Omit<PriceAlert, "id" | "createdAt" | "lastFiredAt" | "enabled">) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  markFired: (id: string, at: number) => void;
  clear: () => void;
}

export const ALERT_COOLDOWN_MS = 5 * 60_000;

export const useAlerts = create<AlertsState>()(
  persist(
    (set) => ({
      alerts: [],
      add: (alert) =>
        set((state) => ({
          alerts: [
            {
              ...alert,
              id: createId("alert"),
              enabled: true,
              createdAt: Date.now(),
              lastFiredAt: null,
            },
            ...state.alerts,
          ].slice(0, 60),
        })),
      remove: (id) => set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
      toggle: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
        })),
      markFired: (id, at) =>
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, lastFiredAt: at } : a)),
        })),
      clear: () => set({ alerts: [] }),
    }),
    { name: "crypto-radar:v2:alerts", version: 2 },
  ),
);

export function describeAlert(alert: PriceAlert): string {
  return `${alert.direction === "above" ? "价格 ≥" : "价格 ≤"} ${alert.price}`;
}
