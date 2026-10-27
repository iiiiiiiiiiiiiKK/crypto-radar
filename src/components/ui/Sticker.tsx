import type { ReactNode } from "react";

export type StickerTone = "neon" | "alarm" | "voltage" | "warn" | "muted" | "cyan";

const TONE: Record<StickerTone, string> = {
  neon: "text-accent",
  alarm: "text-down",
  voltage: "text-voltage",
  warn: "text-warn",
  cyan: "text-cyan",
  muted: "text-muted",
};

/** A small comic/arcade label. Kept deliberately sparse in the layout. */
export function Sticker({
  children,
  tone = "muted",
  flat = false,
  className = "",
}: {
  children: ReactNode;
  tone?: StickerTone;
  flat?: boolean;
  className?: string;
}) {
  return (
    <span className={`sticker ${flat ? "sticker-flat" : ""} ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}
