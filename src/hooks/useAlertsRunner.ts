import { useEffect } from "react";
import { engine } from "@/engine/engine";
import { ALERT_COOLDOWN_MS, describeAlert, useAlerts } from "@/stores/alerts";
import { useToasts } from "@/stores/ui";
import { formatPrice } from "@/lib/format";

/**
 * Price alerts evaluated against the live feed.
 *
 * They only run while this page is open — the UI says so explicitly. Nothing is
 * claimed about notifications after the tab is closed.
 */
export function useAlertsRunner(): void {
  const alerts = useAlerts((state) => state.alerts);
  const markFired = useAlerts((state) => state.markFired);
  const push = useToasts((state) => state.push);

  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      for (const alert of alerts) {
        if (!alert.enabled) continue;
        if (alert.lastFiredAt !== null && now - alert.lastFiredAt < ALERT_COOLDOWN_MS) continue;
        const row = engine.store.getRow(alert.key);
        if (!row || row.price === null) continue;
        const hit =
          alert.direction === "above" ? row.price >= alert.price : row.price <= alert.price;
        if (!hit) continue;
        markFired(alert.id, now);
        push({
          tone: "warn",
          title: `${alert.symbol} 触发价格提醒`,
          text: `当前 ${formatPrice(row.price, row.decimals)} · 条件 ${describeAlert(alert)}`,
        });
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [alerts, markFired, push]);
}
