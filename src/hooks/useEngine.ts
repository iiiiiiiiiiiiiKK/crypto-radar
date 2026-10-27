import { useCallback, useMemo, useSyncExternalStore } from "react";
import { engine, type EngineSnapshot } from "@/engine/engine";
import { computeMood, type MoodReading } from "@/engine/mood";
import type { MarketEvent } from "@/engine/events";
import type { MarketId, TickerRow } from "@/types/market";

/** Connection state, errors and version counter of the whole engine. */
export function useEngineStatus(): EngineSnapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}

/** Throttled list level version: bumps at most every ~320 ms. */
export function useStoreVersion(): number {
  return useSyncExternalStore(
    engine.store.subscribeAll,
    () => engine.store.version,
    () => engine.store.version,
  );
}

/** One live row. Only this component re-renders when its price changes. */
export function useRow(key: string | null | undefined): TickerRow | null {
  const subscribe = useCallback(
    (listener: () => void) => (key ? engine.store.subscribeRow(key, listener) : () => {}),
    [key],
  );
  const getSnapshot = useCallback(() => (key ? engine.store.getRow(key) : null), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function readMarketRows(market: MarketId, _version: number): TickerRow[] {
  return engine.store.getRows(market);
}

export function useMarketRows(market: MarketId): TickerRow[] {
  const version = useStoreVersion();
  return useMemo(() => readMarketRows(market, version), [market, version]);
}

function readScanRows(_version: number): TickerRow[] {
  return engine.scanUniverse();
}

/** Spot + perpetual rows: the universe the radar and the mood engine work on. */
export function useScanRows(): TickerRow[] {
  const version = useStoreVersion();
  return useMemo(() => readScanRows(version), [version]);
}

function readEventList(_version: number): MarketEvent[] {
  return engine.events.all.slice();
}

export function useEvents(): MarketEvent[] {
  const version = useSyncExternalStore(
    engine.events.subscribe,
    () => engine.events.currentVersion,
    () => engine.events.currentVersion,
  );
  return useMemo(() => readEventList(version), [version]);
}

function readMood(_version: number): MoodReading {
  return computeMood(engine.scanUniverse(), Date.now());
}

export function useMood(): MoodReading {
  const version = useStoreVersion();
  return useMemo(() => readMood(version), [version]);
}
