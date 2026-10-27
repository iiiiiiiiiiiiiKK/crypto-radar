import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { DEFAULT_THRESHOLDS, type EventThresholds } from "@/features/events/rules";

/** Threshold editor used by the event centre. */
export function ThresholdDrawer({
  thresholds,
  onChange,
}: {
  thresholds: EventThresholds;
  onChange: (next: EventThresholds) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const field = (
    key: keyof EventThresholds,
    label: string,
    step: string,
    testId: string,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="cr-label">{label}</span>
      <input
        className="cr-input cr-mono"
        type="number"
        step={step}
        value={thresholds[key]}
        onChange={(event) => onChange({ ...thresholds, [key]: Number(event.target.value) })}
        data-testid={testId}
      />
    </label>
  );

  return (
    <div className="relative">
      <button
        type="button"
        className="cr-btn h-6 px-2 text-2xs"
        onClick={() => setOpen((value) => !value)}
        data-testid="event-settings-toggle"
      >
        ⚙ {t("events.settings")}
      </button>
      {open ? (
        <div className="absolute right-0 top-8 z-30 w-[240px] cr-panel bg-panel p-2.5 flex flex-col gap-2 shadow-xl">
          {field("movePercent", t("events.movePercent"), "0.5", "th-move")}
          {field("burstPercent", t("events.burstPercent"), "0.1", "th-burst")}
          {field("volumeRatio", t("events.volumeRatio"), "0.5", "th-volume")}
          {field("fundingPercent", t("events.fundingPercent"), "0.005", "th-funding")}
          <button
            type="button"
            className="cr-btn"
            onClick={() => onChange(DEFAULT_THRESHOLDS)}
            data-testid="event-settings-reset"
          >
            {t("events.resetThresholds")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
