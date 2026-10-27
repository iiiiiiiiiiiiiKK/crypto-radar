import { useI18n } from "@/hooks/useI18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useMarketStore } from "@/stores/marketStore";
import { useWatchlistStore } from "@/stores/watchlistStore";
import { safeStorage } from "@/services/storage/safeStorage";
import { Avatar, AVATARS } from "./Avatar";
import type { HomeView, ThemeId } from "@/services/storage/settings";
import type { Language } from "@/types/market";
import type { TableDensity } from "@/types/ui";

/** Pixel avatars drawn with CSS grid — no image assets, no external fonts. */
export function ProfilePage() {
  const { t } = useI18n();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const density = useSettingsStore((state) => state.density);
  const setDensity = useSettingsStore((state) => state.setDensity);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const avatar = useSettingsStore((state) => state.avatar);
  const setAvatar = useSettingsStore((state) => state.setAvatar);
  const homeView = useSettingsStore((state) => state.homeView);
  const setHomeView = useSettingsStore((state) => state.setHomeView);
  const reset = useSettingsStore((state) => state.reset);
  const connection = useMarketStore((state) => state.state);
  const lists = useWatchlistStore((state) => state.lists);

  const themes: Array<{ id: ThemeId; key: string }> = [
    { id: "neon", key: "profile.themeNeon" },
    { id: "voltage", key: "profile.themeVoltage" },
    { id: "alarm", key: "profile.themeAlarm" },
  ];

  const views: Array<{ id: HomeView; key: string }> = [
    { id: "arena", key: "profile.layoutArena" },
    { id: "table", key: "profile.layoutTable" },
    { id: "heatmap", key: "profile.layoutHeatmap" },
  ];

  const watched = lists.reduce((sum, list) => sum + list.entries.length, 0);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto cr-scroll">
      <div className="max-w-3xl mx-auto p-2 sm:p-4 flex flex-col gap-3">
        <header>
          <h1 className="pixel-title text-sm">{t("profile.title")}</h1>
          <p className="text-2xs text-faint mt-0.5">{t("profile.subtitle")}</p>
        </header>

        {!safeStorage.available ? (
          <div className="cr-panel bg-warn/10 border-warn/40 p-2.5 text-xs text-warn">
            {t("profile.storageOff")}
          </div>
        ) : null}

        <section className="cr-panel p-3 flex items-center gap-3">
          <Avatar id={avatar} size={64} />
          <div className="min-w-0">
            <div className="pixel-title text-sm">TRADER</div>
            <div className="text-2xs text-faint mt-0.5">
              {watched} ★ · {t("market.connect." + connection)}
            </div>
            <div className="text-2xs text-faint">
              {lists.length} {t("watchlist.items")}
            </div>
          </div>
        </section>

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="cr-label">{t("profile.avatar")}</h2>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((item) => (
              <button
                key={item}
                type="button"
                className={`p-1 border ${avatar === item ? "border-accent" : "border-line"}`}
                onClick={() => setAvatar(item)}
                data-testid={`avatar-${item}`}
              >
                <Avatar id={item} size={40} />
              </button>
            ))}
          </div>
        </section>

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="cr-label">{t("profile.theme")}</h2>
          <div className="flex flex-wrap gap-2">
            {themes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`cr-btn ${theme === item.id ? "cr-btn-primary" : ""}`}
                onClick={() => setTheme(item.id)}
                data-testid={`theme-${item.id}`}
              >
                {t(item.key)}
              </button>
            ))}
          </div>
        </section>

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="cr-label">{t("profile.layout")}</h2>
          <div className="flex flex-wrap gap-2">
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`cr-btn ${homeView === item.id ? "cr-btn-primary" : ""}`}
                onClick={() => setHomeView(item.id)}
                data-testid={`home-view-pref-${item.id}`}
              >
                {t(item.key)}
              </button>
            ))}
          </div>
        </section>

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="cr-label">{t("market.density")}</h2>
          <div className="flex flex-wrap gap-2">
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
        </section>

        <section className="cr-panel p-3 flex flex-col gap-2">
          <h2 className="cr-label">{t("settings.language")}</h2>
          <div className="flex gap-2">
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

        <button type="button" className="cr-btn self-start" onClick={reset}>
          {t("profile.reset")}
        </button>
      </div>
    </div>
  );
}
