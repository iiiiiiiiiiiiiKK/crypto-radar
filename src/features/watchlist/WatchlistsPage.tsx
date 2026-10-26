import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { useMarketStore } from "@/stores/marketStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { PercentText } from "@/components/ui";
import type { MarketId } from "@/types/market";

const ROUTE_BY_MARKET: Record<string, string> = {
  spot: "spot",
  futures: "futures",
  alpha: "alpha",
};

export function WatchlistsPage() {
  const { t } = useI18n();
  const lists = useWatchlistStore((state) => state.lists);
  const activeListId = useWatchlistStore((state) => state.activeListId);
  const setActiveList = useWatchlistStore((state) => state.setActiveList);
  const createList = useWatchlistStore((state) => state.createList);
  const renameList = useWatchlistStore((state) => state.renameList);
  const deleteList = useWatchlistStore((state) => state.deleteList);
  const removeEntry = useWatchlistStore((state) => state.removeEntry);
  const reorderLists = useWatchlistStore((state) => state.reorderLists);

  const tickers = useMarketStore((state) => state.tickers);

  const [newListOpen, setNewListOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const active = lists.find((list) => list.id === activeListId) ?? lists[0];

  const tickerMap = useMemo(() => {
    const map = new Map<string, (typeof tickers)[number]>();
    for (const ticker of tickers) map.set(`${ticker.market}:${ticker.symbol}`, ticker);
    return map;
  }, [tickers]);

  const submitNew = () => {
    const id = createList(listName);
    setActiveList(id);
    setListName("");
    setNewListOpen(false);
  };

  const submitRename = () => {
    if (renamingId) renameList(renamingId, renameValue);
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-line bg-panel px-2 sm:px-3 py-2 flex items-center gap-2">
        <h1 className="text-sm font-semibold">{t("watchlist.title")}</h1>
        <button type="button" className="cr-btn cr-btn-primary" onClick={() => setNewListOpen(true)}>
          + {t("watchlist.create")}
        </button>
        <span className="ml-auto text-2xs text-faint">{lists.length} lists</span>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-[190px] shrink-0 border-r border-line bg-panel overflow-y-auto cr-scroll">
          {lists.map((list, index) => (
            <div
              key={list.id}
              className={`flex items-center gap-1 px-2 h-8 border-b border-line-soft cursor-pointer ${
                list.id === active?.id ? "bg-accent/10 text-accent" : "text-muted hover:text-text"
              }`}
              onClick={() => setActiveList(list.id)}
            >
              <span className="truncate flex-1 text-xs" data-testid="watchlist-name">
                {list.name}
              </span>
              <span className="text-2xs text-faint cr-mono">{list.entries.length}</span>
              <button
                type="button"
                className="text-2xs text-faint hover:text-accent px-1"
                title={t("watchlist.rename")}
                onClick={(event) => {
                  event.stopPropagation();
                  setRenamingId(list.id);
                  setRenameValue(list.name);
                }}
              >
                ✎
              </button>
              {index > 0 ? (
                <button
                  type="button"
                  className="text-2xs text-faint hover:text-accent px-1"
                  title="Move up"
                  onClick={(event) => {
                    event.stopPropagation();
                    reorderLists(index, index - 1);
                  }}
                >
                  ↑
                </button>
              ) : null}
              <button
                type="button"
                className="text-2xs text-faint hover:text-down px-1"
                title={t("watchlist.delete")}
                onClick={(event) => {
                  event.stopPropagation();
                  if (window.confirm(t("watchlist.confirmDelete"))) deleteList(list.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </aside>

        <div className="flex-1 min-w-0 overflow-auto cr-scroll">
          {!active ? (
            <p className="text-xs text-muted p-4">{t("watchlist.empty")}</p>
          ) : active.entries.length === 0 ? (
            <div className="p-6 flex flex-col items-center gap-2 text-center">
              <p className="text-xs text-muted">{t("watchlist.empty")}</p>
              <p className="text-2xs text-faint">{t("watchlist.emptyHint")}</p>
              <Link to="/spot" className="cr-btn">
                {t("nav.spot")}
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="cr-th text-left">{t("market.symbol")}</th>
                  <th className="cr-th text-left">{t("market.spot")}</th>
                  <th className="cr-th text-right">{t("market.price")}</th>
                  <th className="cr-th text-right">{t("market.changePercent")}</th>
                  <th className="cr-th text-right">{t("market.quoteVolume")}</th>
                  <th className="cr-th" />
                </tr>
              </thead>
              <tbody>
                {active.entries.map((entry) => {
                  const ticker = tickerMap.get(entry.key);
                  return (
                    <tr key={entry.key} className="hover:bg-panel-2" data-testid="watchlist-row">
                      <td className="cr-td">
                        <Link
                          className="hover:text-accent"
                          to={`/chart/${ROUTE_BY_MARKET[entry.market] ?? "spot"}/${encodeURIComponent(entry.symbol)}`}
                        >
                          {entry.symbol}
                        </Link>
                      </td>
                      <td className="cr-td text-muted">{t(`market.${entry.market as MarketId}`)}</td>
                      <td className="cr-td text-right cr-mono">
                        {ticker ? ticker.price.toFixed(ticker.decimals) : "--"}
                      </td>
                      <td className="cr-td text-right">
                        <PercentText value={ticker?.priceChangePercent ?? null} />
                      </td>
                      <td className="cr-td text-right cr-mono">
                        {ticker?.quoteVolume24h
                          ? ticker.quoteVolume24h.toLocaleString("en-US", { maximumFractionDigits: 0 })
                          : "--"}
                      </td>
                      <td className="cr-td text-right">
                        <button
                          type="button"
                          className="text-2xs text-faint hover:text-down px-1"
                          onClick={() => removeEntry(active.id, entry.key)}
                          aria-label={t("watchlist.remove")}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={newListOpen} title={t("watchlist.create")} onClose={() => setNewListOpen(false)}>
        <div className="flex flex-col gap-2">
          <input
            className="cr-input"
            value={listName}
            onChange={(event) => setListName(event.target.value)}
            placeholder={t("watchlist.defaultName")}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitNew();
            }}
            data-testid="new-list-name"
          />
          <button type="button" className="cr-btn cr-btn-primary" onClick={submitNew}>
            {t("common.add")}
          </button>
        </div>
      </Modal>

      <Modal
        open={renamingId !== null}
        title={t("watchlist.rename")}
        onClose={() => setRenamingId(null)}
      >
        <div className="flex flex-col gap-2">
          <input
            className="cr-input"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitRename();
            }}
          />
          <button type="button" className="cr-btn cr-btn-primary" onClick={submitRename}>
            {t("common.save")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
