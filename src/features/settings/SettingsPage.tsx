import { useI18n } from "@/hooks/useI18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useMarketStore } from "@/stores/marketStore";
import { safeStorage } from "@/services/storage/safeStorage";
import type { Language } from "@/types/market";
import type { TableDensity } from "@/types/ui";

export function SettingsPage() {
  const { t } = useI18n();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const density = useSettingsStore((state) => state.density);
  const setDensity = useSettingsStore((state) => state.setDensity);
  const interval = useSettingsStore((state) => state.interval);
  const setInterval = useSettingsStore((state) => state.setInterval);
  const reset = useSettingsStore((state) => state.reset);
  const state = useMarketStore((state) => state.state);

  return (
    <div className="flex-1 min-h-0 overflow-auto cr-scroll">
      <div className="max-w-3xl mx-auto p-3 sm:p-4 flex flex-col gap-4">
        <h1 className="text-sm font-semibold">{t("settings.title")}</h1>

        {!safeStorage.available ? (
          <div className="cr-panel bg-warn/10 border-warn/40 p-2.5 text-xs text-warn">
            {t("settings.storageUnavailable")}
          </div>
        ) : null}

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="text-xs font-medium text-accent">{t("settings.language")}</h2>
          <div className="flex items-center gap-2">
            {(["zh", "en"] as Language[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`cr-btn ${language === value ? "cr-btn-primary" : ""}`}
                onClick={() => setLanguage(value)}
                data-testid={`language-${value}`}
              >
                {value === "zh" ? t("settings.chinese") : t("settings.english")}
              </button>
            ))}
          </div>
        </section>

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="text-xs font-medium text-accent">{t("settings.appearance")}</h2>
          <div className="flex flex-col gap-1.5">
            <span className="cr-label">{t("market.density")}</span>
            <div className="flex items-center gap-2">
              {(["compact", "cozy", "roomy"] as TableDensity[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`cr-btn ${density === value ? "cr-btn-primary" : ""}`}
                  onClick={() => setDensity(value)}
                >
                  {value === "compact"
                    ? t("market.densityCompact")
                    : value === "cozy"
                      ? t("market.densityCozy")
                      : t("market.densityRoomy")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="cr-label">{t("chart.period")}</span>
            <input
              className="cr-input w-32"
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
          </div>
        </section>

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="text-xs font-medium text-accent">{t("settings.shortcuts")}</h2>
          <ul className="flex flex-col gap-1 text-xs text-muted">
            <li>{t("settings.shortcutSearch")}</li>
            <li>{t("settings.shortcutEscape")}</li>
            <li>{t("settings.shortcutMarket")}</li>
          </ul>
        </section>

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="text-xs font-medium text-accent">{t("settings.data")}</h2>
          <p className="text-xs text-muted">{t("settings.dataSource")}</p>
          <p className="text-xs text-muted">
            {t("market.connect." + state)} · {t("market.source")}: Binance
          </p>
          <p className="text-2xs text-faint leading-relaxed">{t("settings.disclaimer")}</p>
        </section>

        <button type="button" className="cr-btn self-start" onClick={reset}>
          {t("settings.resetSettings")}
        </button>
      </div>
    </div>
  );
}
