import { safeStorage } from "./safeStorage";
import type { MarketId } from "@/types/market";

export type AlertDirection = "above" | "below";

export interface AlertRule {
  id: string;
  market: MarketId;
  symbol: string;
  direction: AlertDirection;
  /** Threshold in quote currency. */
  value: number;
  createdAt: number;
  /** The last time this rule fired, if ever. */
  triggeredAt: number | null;
  /** The price that fired the rule. */
  triggeredPrice: number | null;
  enabled: boolean;
}

const STORAGE_KEY = "crypto-radar:alerts:v1";

export function loadAlerts(): AlertRule[] {
  const raw = safeStorage.get<unknown>(STORAGE_KEY, null);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRule);
}

export function saveAlerts(rules: AlertRule[]): void {
  safeStorage.set(STORAGE_KEY, rules);
}

export function isRule(value: unknown): value is AlertRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Record<string, unknown>;
  return (
    typeof rule.id === "string" &&
    typeof rule.symbol === "string" &&
    (rule.market === "spot" || rule.market === "futures" || rule.market === "alpha") &&
    (rule.direction === "above" || rule.direction === "below") &&
    typeof rule.value === "number" &&
    Number.isFinite(rule.value) &&
    typeof rule.createdAt === "number"
  );
}

export function createRule(
  market: MarketId,
  symbol: string,
  direction: AlertDirection,
  value: number,
): AlertRule {
  return {
    id: `alert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    market,
    symbol,
    direction,
    value,
    createdAt: Date.now(),
    triggeredAt: null,
    triggeredPrice: null,
    enabled: true,
  };
}
