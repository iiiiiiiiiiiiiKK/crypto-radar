import { useCallback, useEffect, useRef, useState } from "react";
import { useMarketStore } from "@/stores/marketStore";
import { VolumeTracker } from "@/features/arena/boards";
import {
  DEFAULT_THRESHOLDS,
  EventStore,
  detectEvents,
  type EventThresholds,
  type MarketEvent,
  type PreviousSample,
} from "./rules";

export interface EventStream {
  events: MarketEvent[];
  thresholds: EventThresholds;
  setThresholds: (next: EventThresholds) => void;
  clear: () => void;
  dismiss: (id: string) => void;
}

/**
 * Watches the live market feed and turns it into an event stream.
 *
 * The hook is deliberately independent from the table: it compares the newest
 * snapshot with the previous one and only emits events whose condition really
 * held, with a per-rule cooldown so a single move does not flood the feed.
 */
export function useEventStream(): EventStream {
  const tickers = useMarketStore((state) => state.tickers);
  const market = useMarketStore((state) => state.market);
  const storeRef = useRef(new EventStore());
  const trackerRef = useRef(new VolumeTracker());
  const previousRef = useRef(new Map<string, PreviousSample>());
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [thresholds, setThresholds] = useState<EventThresholds>(DEFAULT_THRESHOLDS);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (tickers.length === 0) return;
    const now = Date.now();
    trackerRef.current.update(tickers, now);

    const detected = detectEvents(tickers, {
      market,
      thresholds,
      previous: previousRef.current,
      spike: (symbol) => {
        const ticker = tickers.find((item) => item.symbol === symbol);
        if (!ticker || ticker.quoteVolume24h === null) return null;
        return trackerRef.current.spike(symbol, ticker.quoteVolume24h, now);
      },
      isCoolingDown: (ruleId, symbol, at) =>
        storeRef.current.isCoolingDown(ruleId, symbol, at),
      now,
    });

    for (const ticker of tickers) {
      previousRef.current.set(ticker.symbol, { price: ticker.price, at: now });
    }

    if (detected.length > 0) {
      storeRef.current.push(detected);
      setEvents(storeRef.current.all);
    }
  }, [tickers, market, thresholds]);

  const clear = useCallback(() => {
    storeRef.current.clear();
    previousRef.current.clear();
    setEvents([]);
    setDismissed(new Set());
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  return {
    events: events.filter((event) => !dismissed.has(event.id)),
    thresholds,
    setThresholds,
    clear,
    dismiss,
  };
}
