import { useMemo, useState } from "react";
import { HudPanel } from "@/components/ui";
import { EventRow } from "./EventRow";
import { useI18n } from "@/hooks/useI18n";
import type { EventRuleId, EventSeverity, MarketEvent } from "@/features/events/rules";

const RULES: EventRuleId[] = [
  "surge",
  "dump",
  "volume-burst",
  "funding-extreme",
  "new-high",
  "new-low",
];

const SEVERITIES: EventSeverity[] = ["critical", "warn", "info"];

export function EventFeed({
  events,
  onOpen,
  onDismiss,
  onClear,
  settings,
  compact = false,
}: {
  events: MarketEvent[];
  onOpen: (event: MarketEvent) => void;
  onDismiss: (id: string) => void;
  onClear: () => void;
  settings?: React.ReactNode;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [ruleFilter, setRuleFilter] = useState<EventRuleId | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | "all">("all");

  const visible = useMemo(() => {
    const filtered = events.filter(
      (event) =>
        (ruleFilter === "all" || event.ruleId === ruleFilter) &&
        (severityFilter === "all" || event.severity === severityFilter),
    );
    return compact ? filtered.slice(0, 12) : filtered;
  }, [events, ruleFilter, severityFilter, compact]);

  return (
    <HudPanel
      title={t("events.title")}
      accent="alarm"
      hint={compact ? undefined : t("events.subtitle")}
      className="min-h-0 flex flex-col"
      bodyClassName="flex flex-col min-h-0 flex-1"
      action={
        <>
          <span className="cr-mono text-2xs text-faint">{events.length}</span>
          <button
            type="button"
            className="cr-btn h-6 px-2 text-2xs"
            onClick={onClear}
            data-testid="events-clear"
          >
            {t("events.clear")}
          </button>
        </>
      }
    >
      {!compact ? (
        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-line-soft">
          <button
            type="button"
            className={`cr-tab ${ruleFilter === "all" ? "cr-tab-active" : ""}`}
            onClick={() => setRuleFilter("all")}
          >
            {t("market.all")}
          </button>
          {RULES.map((rule) => (
            <button
              key={rule}
              type="button"
              className={`cr-tab ${ruleFilter === rule ? "cr-tab-active" : ""}`}
              onClick={() => setRuleFilter(rule)}
              data-testid={`event-filter-${rule}`}
            >
              {t(`events.rule_${rule}`)}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {SEVERITIES.map((severity) => (
              <button
                key={severity}
                type="button"
                className={`cr-chip ${severityFilter === severity ? "border-accent text-accent" : "text-muted"}`}
                onClick={() => setSeverityFilter(severityFilter === severity ? "all" : severity)}
              >
                {t(`events.severity${severity === "critical" ? "Critical" : severity === "warn" ? "Warn" : "Info"}`)}
              </button>
            ))}
          </div>
          {settings}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="py-8 text-center" data-testid="events-empty">
          <p className="text-2xs text-muted">{t("events.empty")}</p>
          <p className="text-2xs text-faint mt-1">{t("events.emptyHint")}</p>
        </div>
      ) : (
        <ul className={`overflow-y-auto cr-scroll ${compact ? "max-h-[264px]" : "flex-1 min-h-0"}`} data-testid="event-list">
          {visible.map((event) => (
            <EventRow key={event.id} event={event} onOpen={onOpen} onDismiss={onDismiss} />
          ))}
        </ul>
      )}
    </HudPanel>
  );
}
