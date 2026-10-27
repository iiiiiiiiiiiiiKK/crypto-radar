import { create } from "zustand";
import { MarketFeed } from "@/services/websocket/marketFeed";
import type { ConnectionState, MarketId, MarketTicker } from "@/types/market";

interface MarketState {
  market: MarketId;
  tickers: MarketTicker[];
  state: ConnectionState;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  feed: MarketFeed | null;
  setMarket: (market: MarketId) => void;
  applyTickers: (tickers: MarketTicker[]) => void;
  setState: (state: ConnectionState) => void;
  setError: (message: string | null) => void;
  refresh: () => Promise<void>;
  teardown: () => void;
}

/**
 * The ticker map lives outside of React state so that a 250 ms batch of
 * websocket deltas only re-renders the rows that actually changed.
 */
const tickerMap = new Map<string, MarketTicker>();
let snapshotApplied = false;

export const useMarketStore = create<MarketState>((set, get) => ({
  market: "spot",
  tickers: [],
  state: "idle",
  loading: true,
  error: null,
  lastUpdated: null,
  feed: null,

  setMarket: (market) => {
    if (get().market === market && get().feed) return;
    get().teardown();
    tickerMap.clear();
    snapshotApplied = false;
    set({ market, tickers: [], loading: true, error: null, state: "connecting", lastUpdated: null });
    void startFeed(market, set, get);
  },

  applyTickers: (tickers) => {
    const isSnapshot = tickers.length > 0 && !snapshotApplied;
    if (isSnapshot) {
      tickerMap.clear();
      snapshotApplied = true;
    }
    for (const ticker of tickers) {
      const previous = tickerMap.get(ticker.symbol);
      if (!previous) {
        tickerMap.set(ticker.symbol, ticker);
        continue;
      }
      tickerMap.set(ticker.symbol, {
        ...previous,
        ...ticker,
        // Keep the richer snapshot fields that the mini ticker does not carry.
        markPrice: ticker.markPrice ?? previous.markPrice,
        indexPrice: ticker.indexPrice ?? previous.indexPrice,
        fundingRate: ticker.fundingRate ?? previous.fundingRate,
        nextFundingTime: ticker.nextFundingTime ?? previous.nextFundingTime,
        openInterest: ticker.openInterest ?? previous.openInterest,
        listingTime: ticker.listingTime ?? previous.listingTime,
        decimals: previous.decimals || ticker.decimals,
      });
    }
    set({
      tickers: [...tickerMap.values()],
      lastUpdated: Date.now(),
      loading: false,
      error: null,
    });
  },

  setState: (state) => set({ state }),
  setError: (error) => set({ error, loading: false }),

  refresh: async () => {
    const feed = get().feed;
    if (feed) await feed.refresh();
  },

  teardown: () => {
    get().feed?.stop();
    set({ feed: null });
  },
}));

type SetState = (partial: Partial<MarketState>) => void;
type GetState = () => MarketState;

async function startFeed(
  market: MarketId,
  set: SetState,
  get: GetState,
): Promise<void> {
  const feed = new MarketFeed(market, {
    onTickers: (tickers) => {
      if (get().market !== market) return;
      get().applyTickers(tickers);
    },
    onState: (state) => {
      if (get().market !== market) return;
      set({ state });
    },
    onError: (error) => {
      if (get().market !== market) return;
      set({ error: describeError(error), loading: false });
    },
  });
  set({ feed });
  await feed.start();
}

/**
 * Turns a transport failure into a message the user can act on.
 * The exchange rejects some networks and some IPs — that is not a bug in the
 * application, so the message says so instead of showing a stack trace.
 */
function describeError(error: Error): string {
  const status = /^Binance request failed \((\d+)\)/.exec(error.message)?.[1];
  if (status === "418" || status === "429") {
    return `Binance rate limited this network (HTTP ${status}). The client retries the other official hosts automatically — try again in a minute.`;
  }
  if (status === "403" || status === "451") {
    return `Binance refused this network (HTTP ${status}). The perpetual API is not reachable from here; the spot and Alpha feeds keep working.`;
  }
  if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
    return "The Binance API is unreachable from this network. Check the connection or use a proxy.";
  }
  return error.message;
}

export function marketKeyOf(market: MarketId, symbol: string): string {
  return `${market}:${symbol}`;
}
