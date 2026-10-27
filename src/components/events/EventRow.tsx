import { Sticker } from "@/components/ui/Sticker";
import { useI18n } from "@/hooks/useI18n";
import { formatPrice, formatTimeAgo } from "@/lib/format";
import type { MarketEvent } from "@/features/events/rules";
import type { MarketId } from "@/types/market";

const SEVERITY_TONE = {
  info: "text-cyan",
  warn: "text-warn",
  critical: "text-down",
} as const;

const SEVERITY_LABEL = {
  info: "events.severityInfo",
  warn: "events.severityWarn",
  critical: "events.severityCritical",
} as const;

export function EventRow({
  event,
  onOpen,
  onDismiss,
  now = Date.now(),
}: {
  event: MarketEvent;
  onOpen: (event: MarketEvent) => void;
  onDismiss?: (id: string) => void;
  now?: number;
}) {
  const { t } = useI18n();
  const value =
    event.unit === "ratio"
      ? `${event.value.toFixed(1)}×`
      : `${event.value > 0 ? "+" : ""}${event.value.toFixed(2)}%`;

  return (
    <li
      className="flex items-center gap-2 px-2 py-1.5 border-b border-line-soft hover:bg-panel-2"
      data-testid="event-row"
      data-rule={event.ruleId}
    >
      <span className={`w-1 self-stretch shrink-0 ${event.severity === "critical" ? "bg-down" : event.severity === "warn" ? "bg-warn" : "bg-cyan"}`} />
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpen(event)}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold truncate">{event.symbol}</span>
          <Sticker tone="muted" flat>
            {t(`market.${event.market as MarketId}`)}
          </Sticker>
          <Sticker tone={event.severity === "critical" ? "alarm" : event.severity === "warn" ? "warn" : "cyan"} flat>
            {t(SEVERITY_LABEL[event.severity])}
          </Sticker>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-2xs">
          <span className={`cr-mono ${SEVERITY_TONE[event.severity]}`}>{value}</span>
          <span className="text-faint truncate">{t(`events.rule_${event.ruleId}`)}</span>
          <span className="cr-mono text-faint ml-auto shrink-0">
            {formatPrice(event.price, 4)} · {formatTimeAgo(event.createdAt, now)}
          </span>
        </div>
      </button>
      {onDismiss ? (
        <button
          type="button"
          className="text-2xs text-faint hover:text-down px-1 shrink-0"
          onClick={() => onDismiss(event.id)}
          aria-label={t("events.dismiss")}
        >
          ✕
        </button>
      ) : null}
    </li>
  );
}
