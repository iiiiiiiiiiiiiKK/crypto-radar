import { formatPercent, isNum } from "@/lib/format";

interface DeltaProps {
  value: number | null | undefined;
  digits?: number;
  suffix?: string;
  arrow?: boolean;
  className?: string;
  fontSize?: number;
}

/**
 * Signed change value. Direction is carried by the sign, the arrow glyph and
 * the colour, so colour is never the only signal.
 */
export function Delta({
  value,
  digits = 2,
  suffix = "%",
  arrow = true,
  className = "",
  fontSize,
}: DeltaProps) {
  if (!isNum(value)) {
    return (
      <span className={`delta dim ${className}`} style={fontSize ? { fontSize } : undefined}>
        --
      </span>
    );
  }
  const sign = value > 0 ? "up" : value < 0 ? "down" : "flat";
  return (
    <span className={`delta ${sign} ${className}`} style={fontSize ? { fontSize } : undefined}>
      {arrow ? (
        <span className="delta__arrow">{value > 0 ? "▲" : value < 0 ? "▼" : "•"}</span>
      ) : null}
      {formatPercent(value, digits)}
      {suffix === "%" ? null : suffix}
    </span>
  );
}
