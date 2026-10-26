import type { ReactNode } from "react";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted" role="status" aria-live="polite">
      <span className="w-3 h-3 rounded-full border border-accent/40 border-t-accent animate-spin" aria-hidden />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center animate-fade-in">
      <p className="text-xs text-muted">{title}</p>
      {hint ? <p className="text-2xs text-faint max-w-xs">{hint}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
  retryLabel,
}: {
  title: string;
  detail?: string | null;
  onRetry?: () => void;
  retryLabel: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-10 text-center animate-fade-in"
      role="alert"
    >
      <p className="text-xs text-down">{title}</p>
      {detail ? <p className="text-2xs text-faint max-w-md break-words">{detail}</p> : null}
      {onRetry ? (
        <button type="button" className="cr-btn cr-btn-primary mt-1" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
