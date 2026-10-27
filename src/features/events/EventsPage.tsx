import { useNavigate } from "react-router-dom";
import { EventFeed } from "@/components/events/EventFeed";
import { ThresholdDrawer } from "@/components/events/ThresholdDrawer";
import { useOwnMarketData } from "@/hooks/useOwnMarketData";
import { useEventStream } from "./useEventStream";
import { useI18n } from "@/hooks/useI18n";

/** Full-page event centre: same engine as the home feed, with filters. */
export function EventsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // Opening this URL directly must still start the live feed.
  useOwnMarketData();
  const stream = useEventStream();

  return (
    <div className="flex-1 min-h-0 flex flex-col p-2 gap-2">
      <header className="shrink-0 flex flex-wrap items-baseline gap-2">
        <h1 className="pixel-title text-sm">{t("events.title")}</h1>
        <p className="text-2xs text-faint hidden sm:block">{t("events.subtitle")}</p>
      </header>
      <EventFeed
        events={stream.events}
        onOpen={(event) => navigate(`/chart/${event.market}/${encodeURIComponent(event.symbol)}`)}
        onDismiss={stream.dismiss}
        onClear={stream.clear}
        settings={
          <ThresholdDrawer thresholds={stream.thresholds} onChange={stream.setThresholds} />
        }
      />
    </div>
  );
}
