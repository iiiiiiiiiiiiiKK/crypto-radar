import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { useAlertStore } from "@/stores/alertStore";
import { useScreenerData } from "@/features/screener/useScreenerData";
import { useMarketStore } from "@/stores/marketStore";
import { formatPrice, formatTimeAgo } from "@/lib/format";
import type { AlertDirection } from "@/services/storage/alerts";
import type { MarketId } from "@/types/market";

/**
 * Price alerts.
 *
 * The rules are evaluated by `useAlertEngine` while the terminal is open, so
 * the page only has to create, enable and remove them.
 */
export function AlertsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const rules = useAlertStore((state) => state.rules);
  const add = useAlertStore((state) => state.add);
  const remove = useAlertStore((state) => state.remove);
  const toggle = useAlertStore((state) => state.toggle);
  const reset = useAlertStore((state) => state.reset);

  const market = useMarketStore((state) => state.market);
  const tickers = useMarketStore((state) => state.tickers);

  const [marketId, setMarketId] = useState<MarketId>(market);
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [value, setValue] = useState("");
  const [permission, setPermission] = useState<string>("default");

  const universe = useScreenerData([marketId], 60_000);
  const symbols = useMemo(
    () => universe.tickers.slice(0, 400).map((ticker) => ticker.symbol),
    [universe.tickers],
  );

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const current = useMemo(() => {
    const source = marketId === market ? tickers : universe.tickers;
    return source.find((ticker) => ticker.symbol === symbol);
  }, [marketId, market, tickers, universe.tickers, symbol]);

  const submit = () => {
    const parsed = Number(value);
    if (!symbol || !Number.isFinite(parsed) || parsed <= 0) return;
    add(marketId, symbol, direction, parsed);
    setValue("");
  };

  const askPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto cr-scroll">
      <div className="max-w-4xl mx-auto p-3 sm:p-4 flex flex-col gap-3">
        <div>
          <h1 className="text-sm font-semibold">{t("alerts.title")}</h1>
          <p className="text-2xs text-faint mt-0.5">{t("alerts.subtitle")}</p>
        </div>

        {permission !== "granted" ? (
          <div className="cr-panel bg-warn/10 border-warn/40 p-2.5 flex items-center gap-3">
            <span className="text-xs text-warn flex-1">{t("alerts.enableNotifications")}</span>
            <button type="button" className="cr-btn" onClick={() => void askPermission()}>
              {t("alerts.allow")}
            </button>
          </div>
        ) : null}

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="text-xs font-medium text-accent">{t("alerts.create")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("market.all")}</span>
              <select
                className="cr-select"
                value={marketId}
                onChange={(event) => {
                  setMarketId(event.target.value as MarketId);
                  setSymbol("");
                }}
                data-testid="alert-market"
              >
                <option value="spot">{t("market.spot")}</option>
                <option value="futures">{t("market.futures")}</option>
                <option value="alpha">{t("market.alpha")}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="cr-label">{t("market.symbol")}</span>
              <input
                className="cr-input"
                list="alert-symbols"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                placeholder="BTCUSDT"
                data-testid="alert-symbol"
              />
              <datalist id="alert-symbols">
                {symbols.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("alerts.condition")}</span>
              <select
                className="cr-select"
                value={direction}
                onChange={(event) => setDirection(event.target.value as AlertDirection)}
                data-testid="alert-direction"
              >
                <option value="above">{t("alerts.above")}</option>
                <option value="below">{t("alerts.below")}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="cr-label">{t("alerts.threshold")}</span>
              <input
                className="cr-input cr-mono"
                type="number"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={current ? String(current.price) : "0"}
                data-testid="alert-value"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs text-faint">
              {current
                ? `${t("market.price")} ${formatPrice(current.price, current.decimals)}`
                : t("alerts.pickSymbol")}
            </span>
            <button
              type="button"
              className="cr-btn cr-btn-primary ml-auto"
              onClick={submit}
              data-testid="alert-add"
            >
              {t("alerts.add")}
            </button>
          </div>
        </section>

        {rules.length === 0 ? (
          <EmptyState title={t("alerts.empty")} hint={t("alerts.emptyHint")} />
        ) : (
          <ul className="flex flex-col gap-1.5" data-testid="alert-list">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="cr-panel px-3 py-2 flex items-center gap-3"
                data-testid="alert-row"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{rule.symbol}</span>
                    <span className="cr-chip text-faint">{t(`market.${rule.market}`)}</span>
                    <span className={`cr-mono text-2xs ${rule.direction === "above" ? "cr-up" : "cr-down"}`}>
                      {rule.direction === "above" ? "≥" : "≤"} {rule.value}
                    </span>
                  </div>
                  <div className="text-2xs text-faint mt-0.5">
                    {rule.triggeredAt
                      ? `${t("alerts.triggered")} ${formatTimeAgo(rule.triggeredAt)}`
                      : rule.enabled
                        ? t("alerts.watching")
                        : t("alerts.paused")}
                  </div>
                </div>

                <button
                  type="button"
                  className="cr-btn cr-btn-icon"
                  onClick={() => navigate(`/chart/${rule.market === "futures" ? "futures" : rule.market}/${encodeURIComponent(rule.symbol)}`)}
                  aria-label={t("chart.detail")}
                >
                  ◱
                </button>
                {rule.triggeredAt ? (
                  <button type="button" className="cr-btn" onClick={() => reset(rule.id)}>
                    {t("alerts.rearm")}
                  </button>
                ) : (
                  <button type="button" className="cr-btn" onClick={() => toggle(rule.id)}>
                    {rule.enabled ? t("alerts.pause") : t("alerts.resume")}
                  </button>
                )}
                <button
                  type="button"
                  className="cr-btn cr-btn-icon"
                  onClick={() => remove(rule.id)}
                  aria-label={t("watchlist.remove")}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
