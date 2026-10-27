import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HudPanel, Sticker } from "@/components/ui";
import { SentimentPanel } from "@/components/sentiment/SentimentPanel";
import { ArenaBoard } from "@/components/arena/ArenaBoard";
import { EventFeed } from "@/components/events/EventFeed";
import { MarketHeatmap } from "@/components/market/MarketHeatmap";
import { MarketPanel } from "@/features/spot/MarketPanel";
import { useMarketData } from "@/features/spot/useMarketData";
import { useEventStream } from "@/features/events/useEventStream";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useMarketStore } from "@/stores/marketStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { makeEntry } from "@/services/storage/watchlists";
import { computeSentiment } from "@/features/sentiment/sentiment";
import { buildBoard, VolumeTracker, type ArenaBoardId } from "@/features/arena/boards";
import type { MarketId, MarketTicker } from "@/types/market";

type HomeView = "arena" | "table" | "heatmap";

/**
 * The home screen of the war room.
 *
 * Order of information follows what a trader checks first:
 *  1. how the market feels right now (computed, explained),
 *  2. who is winning or dying (arena),
 *  3. what just happened (event stream),
 *  4. the full list, one switch away.
 */
export function HomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const lastMarket = useSettingsStore((state) => state.lastMarket);
  const preferredView = useSettingsStore((state) => state.homeView);

  const market: MarketId =
    lastMarket === "futures" || lastMarket === "alpha" || lastMarket === "spot" ? lastMarket : "spot";
  useMarketData(market);

  const tickers = useMarketStore((state) => state.tickers);
  const setMarket = useMarketStore((state) => state.setMarket);

  const watchlists = useWatchlistStore((state) => state.lists);
  const activeListId = useWatchlistStore((state) => state.activeListId);
  const addEntry = useWatchlistStore((state) => state.addEntry);
  const removeEntry = useWatchlistStore((state) => state.removeEntry);

  const [view, setView] = useState<HomeView>(preferredView ?? "arena");
  const [board, setBoard] = useState<ArenaBoardId>("gainers");

  const trackerRef = useRef(new VolumeTracker());
  useEffect(() => {
    trackerRef.current.update(tickers);
  }, [tickers]);

  useEffect(() => {
    setMarket(market);
  }, [market, setMarket]);

  const watchedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const list of watchlists) for (const entry of list.entries) keys.add(entry.key);
    return keys;
  }, [watchlists]);

  const sentiment = useMemo(
    () => computeSentiment({ tickers, withFunding: market === "futures" }),
    [tickers, market],
  );

  const entries = useMemo(
    () =>
      buildBoard({
        tickers,
        board,
        limit: isMobile ? 10 : 16,
        watchedKeys,
        tracker: trackerRef.current,
        market,
      }),
    // the tracker mutates in place; re-evaluating on every ticker flush is intended
    [tickers, board, watchedKeys, market, isMobile],
  );

  const events = useEventStream();

  const activeList = watchlists.find((list) => list.id === activeListId) ?? watchlists[0];
  const toggleWatch = (ticker: MarketTicker) => {
    if (!activeList) return;
    const key = `${market}:${ticker.symbol}`;
    if (activeList.entries.some((entry) => entry.key === key)) removeEntry(activeList.id, key);
    else addEntry(activeList.id, makeEntry(market, ticker.symbol, { name: ticker.name }));
  };

  const openChart = (ticker: MarketTicker) =>
    navigate(`/chart/${market}/${encodeURIComponent(ticker.id || ticker.symbol)}`);

  const views: Array<{ id: HomeView; label: string }> = [
    { id: "arena", label: t("home.viewArena") },
    { id: "table", label: t("home.viewTable") },
    { id: "heatmap", label: t("home.viewHeatmap") },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-2 pt-2 flex flex-col gap-2">
        <SentimentPanel sentiment={sentiment} />

        <div className="flex items-center gap-1">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`cr-tab ${view === item.id ? "cr-tab-active" : ""}`}
              onClick={() => setView(item.id)}
              data-testid={`home-view-${item.id}`}
            >
              {item.label}
            </button>
          ))}
          <Sticker tone="voltage" flat className="ml-auto hidden sm:inline-flex">
            {t("appTagline")}
          </Sticker>
        </div>
      </div>

      {view === "arena" ? (
        <div className="flex-1 min-h-0 overflow-y-auto cr-scroll px-2 py-2 flex flex-col gap-2">
          <div className={`grid gap-2 ${isMobile ? "grid-cols-1" : "grid-cols-[1.35fr_1fr]"}`}>
            <ArenaBoard
              board={board}
              onBoardChange={setBoard}
              entries={entries}
              loading={tickers.length === 0}
              onOpen={openChart}
              onStar={toggleWatch}
              watchedKeys={watchedKeys}
              market={market}
            />
            <EventFeed
              events={events.events}
              onOpen={(event) =>
                navigate(`/chart/${event.market}/${encodeURIComponent(event.symbol)}`)
              }
              onDismiss={events.dismiss}
              onClear={events.clear}
              settings={
                <button
                  type="button"
                  className="cr-btn h-6 px-2 text-2xs"
                  onClick={() => navigate("/events")}
                >
                  {t("common.more")}
                </button>
              }
              compact
            />
          </div>

          <HudPanel
            title={t("home.table")}
            hint={t("home.tableHint")}
            accent="voltage"
            action={
              <button
                type="button"
                className="cr-btn h-6 px-2 text-2xs"
                onClick={() => setView("table")}
              >
                {t("home.viewTable")} →
              </button>
            }
          >
            <TopMovers tickers={tickers} onOpen={openChart} />
          </HudPanel>
        </div>
      ) : view === "heatmap" ? (
        <div className="flex-1 min-h-0 flex flex-col px-2 py-2">
          <MarketHeatmap
            rows={tickers}
            loading={tickers.length === 0}
            onOpenChart={openChart}
          />
        </div>
      ) : (
        <MarketPanel market={market} />
      )}
    </div>
  );
}

/**
 * A compact strip of the biggest movers under the arena. It reuses the same
 * live tickers, so it never shows a different market than the rest of the page.
 */
function TopMovers({
  tickers,
  onOpen,
}: {
  tickers: MarketTicker[];
  onOpen: (ticker: MarketTicker) => void;
}) {
  const movers = useMemo(() => {
    const sorted = [...tickers]
      .filter((ticker) => (ticker.quoteVolume24h ?? 0) > 1_000_000)
      .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
      .slice(0, 12);
    return sorted;
  }, [tickers]);

  if (movers.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 overflow-x-auto no-scrollbar">
      {movers.map((ticker) => {
        const tone = ticker.priceChangePercent > 0 ? "cr-up" : "cr-down";
        return (
          <button
            key={ticker.symbol}
            type="button"
            onClick={() => onOpen(ticker)}
            className="shrink-0 flex items-center gap-1.5 px-2 h-6 border border-line bg-panel-2 hover:border-accent/60"
            data-testid="home-mover"
          >
            <span className="text-2xs font-medium">{ticker.symbol}</span>
            <span className={`cr-mono text-2xs ${tone}`}>
              {ticker.priceChangePercent > 0 ? "+" : ""}
              {ticker.priceChangePercent.toFixed(2)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
