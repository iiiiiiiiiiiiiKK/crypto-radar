import { useEffect, useRef } from "react";
import { getAdapter } from "@/services/binance";
import { isTriggered } from "@/services/storage/alerts";
import { useAlertStore } from "@/stores/alertStore";
import type { MarketId } from "@/types/market";

/**
 * Evaluates the enabled price alerts against the live market.
 *
 * The engine runs while the application is open: it polls only the markets a
 * rule actually references and fires once per rule, then disables it so a
 * threshold cannot spam the user.
 */
export function useAlertEngine(intervalMs = 15_000): void {
  const rules = useAlertStore((state) => state.rules);
  const markTriggered = useAlertStore((state) => state.markTriggered);
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const active = rulesRef.current.filter((rule) => rule.enabled && rule.triggeredAt === null);
      if (active.length === 0) return;

      const markets = [...new Set(active.map((rule) => rule.market))] as MarketId[];
      for (const market of markets) {
        if (cancelled) return;
        let tickers;
        try {
          tickers = await getAdapter(market).listTickers();
        } catch {
          continue;
        }
        const bySymbol = new Map(tickers.map((ticker) => [ticker.symbol, ticker]));
        for (const rule of active) {
          if (rule.market !== market) continue;
          const ticker = bySymbol.get(rule.symbol);
          if (!ticker) continue;
          if (!isTriggered(rule, ticker.price)) continue;
          markTriggered(rule.id, ticker.price);
          notify(rule.symbol, rule.direction, rule.value, ticker.price);
        }
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [markTriggered, intervalMs]);
}

function notify(symbol: string, direction: "above" | "below", target: number, price: number): void {
  if (typeof window === "undefined") return;
  const title = direction === "above" ? `${symbol} 突破 ${target}` : `${symbol} 跌破 ${target}`;
  const body = `现价 ${price}`;
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag: `crypto-radar-${symbol}` });
      return;
    }
  } catch {
    /* the in-app banner is the fallback */
  }
  window.dispatchEvent(new CustomEvent("crypto-radar:alert", { detail: { title, body } }));
}
