import type { ReactNode } from "react";

export interface HudPanelProps {
  title?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: "neon" | "alarm" | "voltage" | "warn";
}

const ACCENT_BORDER: Record<NonNullable<HudPanelProps["accent"]>, string> = {
  neon: "border-accent/40",
  alarm: "border-down/40",
  voltage: "border-voltage/40",
  warn: "border-warn/40",
};

const ACCENT_TEXT: Record<NonNullable<HudPanelProps["accent"]>, string> = {
  neon: "text-accent",
  alarm: "text-down",
  voltage: "text-voltage",
  warn: "text-warn",
};

/**
 * A HUD frame: clipped corners, a corner bracket and a compact header.
 * Used for the hero blocks so the page reads as a terminal panel rather than
 * as a stack of rounded cards.
 */
export function HudPanel({
  title,
  hint,
  action,
  children,
  className = "",
  bodyClassName = "",
  accent = "neon",
}: HudPanelProps) {
  return (
    <section className={`hud-panel hud-corner scanlines ${ACCENT_BORDER[accent]} ${className}`}>
      {title ? (
        <header className="relative z-10 flex items-center gap-2 px-2.5 py-1.5 border-b border-line">
          <span className={`pixel-title text-2xs ${ACCENT_TEXT[accent]}`}>{title}</span>
          {hint ? (
            <span className="hidden sm:inline text-2xs text-faint truncate">{hint}</span>
          ) : null}
          {action ? <div className="ml-auto flex items-center gap-1">{action}</div> : null}
        </header>
      ) : null}
      <div className={`relative z-10 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
