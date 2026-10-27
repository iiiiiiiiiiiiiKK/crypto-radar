import type { ConnectionState } from "@/types/market";
import { useI18n } from "@/hooks/useI18n";

const DOT_CLASS: Record<ConnectionState, string> = {
  idle: "bg-faint",
  connecting: "bg-warn animate-pulse",
  connected: "bg-up shadow-[0_0_6px_rgba(57,255,136,0.9)]",
  reconnecting: "bg-warn animate-pulse",
  disconnected: "bg-down",
  stale: "bg-warn animate-pulse",
  error: "bg-down",
};

export function ConnectionBadge({ state, compact = false }: { state: ConnectionState; compact?: boolean }) {
  const { t } = useI18n();
  const label = t(`market.connect.${state}`);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-2xs text-muted"
      title={label}
      data-testid="connection-badge"
      data-state={state}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASS[state]}`} aria-hidden />
      {!compact && <span className="whitespace-nowrap">{label}</span>}
    </span>
  );
}
