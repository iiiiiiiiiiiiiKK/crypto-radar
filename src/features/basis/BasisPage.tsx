import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, ErrorState, Spinner } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { formatCompact, formatCountdown, formatPrice } from "@/lib/format";
import { useBasisData, type BasisRow } from "./useBasisData";

type SortKey = "basis" | "funding" | "volume";

/**
 * Cross-market basis radar.
 *
 * Spot and perpetual are two separate books on the same asset. This page shows
 * the premium between them and how much that premium costs per year through
 * the funding rate — the signal a single-market table cannot produce.
 */
export function BasisPage() {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { rows, loading, error, lastUpdated, refresh } = useBasisData();
  const [sortKey, setSortKey] = useState<SortKey>("basis");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    const filtered = q
      ? rows.filter((row) => row.base.includes(q) || row.perpSymbol.includes(q))
      : rows;
    const sorted = [...filtered];
    if (sortKey === "basis") sorted.sort((a, b) => Math.abs(b.basisPercent) - Math.abs(a.basisPercent));
    if (sortKey === "funding") {
      sorted.sort(
        (a, b) =>
          Math.abs(b.fundingAnnualPercent ?? 0) - Math.abs(a.fundingAnnualPercent ?? 0),
      );
    }
    if (sortKey === "volume") sorted.sort((a, b) => b.perpQuoteVolume - a.perpQuoteVolume);
    return sorted;
  }, [rows, sortKey, query]);

  const stats = useMemo(() => {
    if (visible.length === 0) return { positive: 0, negative: 0, average: 0 };
    let positive = 0;
    let negative = 0;
    let sum = 0;
    for (const row of visible) {
      sum += row.basisPercent;
      if (row.basisPercent > 0) positive += 1;
      else negative += 1;
    }
    return { positive, negative, average: sum / visible.length };
  }, [visible]);

  const open = (row: BasisRow) =>
    navigate(`/chart/futures/${encodeURIComponent(row.perpSymbol)}`);

  const tone = (value: number) => (value > 0 ? "cr-up" : value < 0 ? "cr-down" : "text-muted");

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-line bg-panel px-2 sm:px-3 py-2 flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold">{t("basis.title")}</h1>
          <p className="text-2xs text-faint hidden sm:block">{t("basis.subtitle")}</p>
        </div>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <input
            className="cr-input w-[132px]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("basis.filter")}
            data-testid="basis-filter"
          />
          <div className="flex items-center gap-0.5" role="group">
            {(["basis", "funding", "volume"] as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`cr-tab ${sortKey === key ? "cr-tab-active" : ""}`}
                onClick={() => setSortKey(key)}
                data-testid={`basis-sort-${key}`}
              >
                {t(`basis.sort${key === "basis" ? "Basis" : key === "funding" ? "Funding" : "Volume"}`)}
              </button>
            ))}
          </div>
          <button type="button" className="cr-btn cr-btn-icon" onClick={refresh} aria-label={t("market.refresh")}>
            ⟳
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-line bg-panel-2 px-3 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs">
        <span className="text-faint">
          {t("basis.pairs")} <span className="cr-mono text-text">{visible.length}</span>
        </span>
        <span className="cr-up">
          {t("basis.premium")} <span className="cr-mono">{stats.positive}</span>
        </span>
        <span className="cr-down">
          {t("basis.discount")} <span className="cr-mono">{stats.negative}</span>
        </span>
        <span className="text-faint">
          {t("basis.average")}{" "}
          <span className={`cr-mono ${tone(stats.average)}`}>
            {stats.average > 0 ? "+" : ""}
            {stats.average.toFixed(3)}%
          </span>
        </span>
        <span className="text-faint ml-auto">
          {lastUpdated
            ? new Date(lastUpdated).toLocaleTimeString(language === "zh" ? "zh-CN" : "en-GB", {
                hour12: false,
              })
            : "--"}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto cr-scroll">
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-12">
            <Spinner label={t("market.loading")} />
          </div>
        ) : error && rows.length === 0 ? (
          <ErrorState
            title={t("market.error")}
            detail={error}
            onRetry={refresh}
            retryLabel={t("market.retry")}
          />
        ) : visible.length === 0 ? (
          <EmptyState title={t("basis.empty")} hint={t("basis.emptyHint")} />
        ) : isMobile ? (
          <ul className="flex flex-col" data-testid="basis-list">
            {visible.map((row) => (
              <li key={row.perpSymbol} data-testid="basis-row">
                <button
                  type="button"
                  onClick={() => open(row)}
                  className="w-full px-3 py-2 border-b border-line-soft text-left active:bg-panel-2"
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold">{row.base}</span>
                    <span className="text-2xs text-faint">PERP</span>
                    <span className={`ml-auto cr-mono text-xs ${tone(row.basisPercent)}`}>
                      {row.basisPercent > 0 ? "+" : ""}
                      {row.basisPercent.toFixed(3)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="cr-mono text-2xs text-faint">
                      S {formatPrice(row.spotPrice, 4)}
                    </span>
                    <span className="cr-mono text-2xs text-faint">
                      P {formatPrice(row.perpPrice, 4)}
                    </span>
                    {row.fundingAnnualPercent === null ? null : (
                      <span className={`ml-auto cr-mono text-2xs ${tone(row.fundingAnnualPercent)}`}>
                        {t("basis.apr")} {row.fundingAnnualPercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <table className="w-full" data-testid="basis-table">
            <thead>
              <tr>
                <th className="cr-th text-left">{t("market.symbol")}</th>
                <th className="cr-th text-right">{t("basis.spotPrice")}</th>
                <th className="cr-th text-right">{t("basis.perpPrice")}</th>
                <th className="cr-th text-right">{t("basis.basis")}</th>
                <th className="cr-th text-right">{t("basis.apr")}</th>
                <th className="cr-th text-right">{t("market.fundingRate")}</th>
                <th className="cr-th text-right">{t("market.nextFunding")}</th>
                <th className="cr-th text-right">{t("market.quoteVolume")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.perpSymbol}
                  className="hover:bg-panel-2 cursor-pointer"
                  onClick={() => open(row)}
                  data-testid="basis-row"
                >
                  <td className="cr-td">
                    <span className="font-medium">{row.base}</span>
                    <span className="text-2xs text-faint ml-1.5">{t("market.futures")}</span>
                  </td>
                  <td className="cr-td text-right cr-mono">{formatPrice(row.spotPrice, 6)}</td>
                  <td className="cr-td text-right cr-mono">{formatPrice(row.perpPrice, 6)}</td>
                  <td className={`cr-td text-right cr-mono ${tone(row.basisPercent)}`}>
                    {row.basisPercent > 0 ? "+" : ""}
                    {row.basisPercent.toFixed(3)}%
                  </td>
                  <td className={`cr-td text-right cr-mono ${tone(row.fundingAnnualPercent ?? 0)}`}>
                    {row.fundingAnnualPercent === null
                      ? "--"
                      : `${row.fundingAnnualPercent > 0 ? "+" : ""}${row.fundingAnnualPercent.toFixed(1)}%`}
                  </td>
                  <td className={`cr-td text-right cr-mono ${tone(row.fundingRate ?? 0)}`}>
                    {row.fundingRate === null ? "--" : `${(row.fundingRate * 100).toFixed(4)}%`}
                  </td>
                  <td className="cr-td text-right cr-mono text-faint">
                    {row.nextFundingTime
                      ? formatCountdown(row.nextFundingTime)
                      : "--"}
                  </td>
                  <td className="cr-td text-right cr-mono text-faint">
                    {formatCompact(row.perpQuoteVolume)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
