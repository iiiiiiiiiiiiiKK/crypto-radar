import { useState } from "react";
import { HudPanel, Sticker } from "@/components/ui";
import { useI18n } from "@/hooks/useI18n";
import { formatCompact } from "@/lib/format";
import type { SentimentResult } from "@/features/sentiment/sentiment";

const TONE: Record<SentimentResult["key"], { ring: string; text: string; tone: "neon" | "alarm" | "voltage" | "warn" | "muted" | "cyan" }> = {
  fomo: { ring: "from-accent/70", text: "text-accent", tone: "neon" },
  greed: { ring: "from-accent/40", text: "text-accent", tone: "neon" },
  chop: { ring: "from-cyan/40", text: "text-cyan", tone: "cyan" },
  fear: { ring: "from-warn/50", text: "text-warn", tone: "warn" },
  panic: { ring: "from-down/60", text: "text-down", tone: "alarm" },
  illiquid: { ring: "from-voltage/50", text: "text-voltage", tone: "voltage" },
};

/**
 * The market mood block.
 *
 * The gauge, the score and the factors all come from `computeSentiment`, which
 * only uses real ticker data — the "why this state" panel exposes the numbers
 * so the reading can be checked rather than trusted.
 */
export function SentimentPanel({ sentiment }: { sentiment: SentimentResult }) {
  const { t } = useI18n();
  const [showWhy, setShowWhy] = useState(false);
  const tone = TONE[sentiment.key];
  const needle = Math.min(100, Math.max(0, sentiment.score));

  const factors = [
    { key: "breadth", label: t("sentiment.breadth"), value: `${sentiment.breadth.toFixed(1)}%` },
    { key: "avg", label: t("sentiment.avgChange"), value: `${sentiment.avgChange >= 0 ? "+" : ""}${sentiment.avgChange.toFixed(2)}%` },
    { key: "median", label: t("sentiment.medianMove"), value: `${sentiment.medianAbsChange.toFixed(2)}%` },
    { key: "turnover", label: t("sentiment.turnover"), value: `$${formatCompact(sentiment.turnover)}` },
  ];

  return (
    <HudPanel
      title={t("sentiment.title")}
      accent={tone.tone === "neon" ? "neon" : tone.tone === "alarm" ? "alarm" : tone.tone === "voltage" ? "voltage" : "warn"}
      action={
        <button
          type="button"
          className="cr-btn h-6 px-2 text-2xs"
          onClick={() => setShowWhy((value) => !value)}
          data-testid="sentiment-why-toggle"
        >
          {showWhy ? t("common.close") : t("sentiment.why")}
        </button>
      }
      bodyClassName="p-2.5"
    >
      <div className="flex items-center gap-3" data-testid="sentiment-panel" data-state={sentiment.key}>
        {/* gauge */}
        <div className="relative shrink-0 w-[92px] h-[52px] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[92px] rounded-full border border-line bg-panel-2" />
          <div
            className={`absolute inset-x-0 top-0 h-[92px] rounded-full bg-gradient-to-t ${tone.ring} to-transparent opacity-40`}
          />
          <div
            className="absolute left-1/2 bottom-0 w-[2px] h-[42px] origin-bottom bg-text transition-transform duration-500"
            style={{ transform: `translateX(-50%) rotate(${-90 + (needle / 100) * 180}deg)` }}
          />
          <div className="absolute left-1/2 bottom-0 w-1.5 h-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-text" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`pixel-title text-base ${tone.text}`} data-testid="sentiment-state">
              {t(`sentiment.${sentiment.key}`)}
            </span>
            <span className="cr-mono text-2xs text-faint">
              {t("sentiment.score")} <span className={`${tone.text}`}>{sentiment.score}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {factors.map((factor) => (
              <span key={factor.key} className="cr-mono text-2xs text-faint">
                {factor.label} <span className="text-text">{factor.value}</span>
              </span>
            ))}
            {sentiment.fundingExtremeShare > 0 ? (
              <span className="cr-mono text-2xs text-faint">
                {t("sentiment.fundingExtreme")}{" "}
                <span className="text-warn">{sentiment.fundingExtremeShare.toFixed(1)}%</span>
              </span>
            ) : null}
          </div>
        </div>

        <Sticker tone={tone.tone} flat className="hidden sm:inline-flex shrink-0">
          {t("sentiment.live")}
        </Sticker>
      </div>

      {showWhy ? (
        <div className="mt-2 pt-2 border-t border-line text-2xs text-muted leading-relaxed">
          <p className="mb-1">
            <span className="cr-label mr-1">{t("sentiment.rule")}</span>
            {t("sentiment.ruleText")}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 cr-mono text-faint">
            {sentiment.factors.map((factor) => (
              <span key={factor.key}>
                {factor.key}=
                {factor.format === "usd"
                  ? `$${formatCompact(factor.value)}`
                  : factor.format === "ratio"
                    ? `${factor.value.toFixed(1)}%`
                    : factor.format === "score"
                      ? factor.value
                      : `${factor.value.toFixed(2)}%`}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </HudPanel>
  );
}
