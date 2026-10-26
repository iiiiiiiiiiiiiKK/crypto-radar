import { formatPercent, formatPrice } from "@/lib/format";

export function PriceText({
  value,
  decimals,
  className = "",
}: {
  value: number | null | undefined;
  decimals: number;
  className?: string;
}) {
  return (
    <span className={`cr-mono ${className}`}>{formatPrice(value, decimals)}</span>
  );
}

export function PercentText({
  value,
  className = "",
  digits = 2,
}: {
  value: number | null | undefined;
  className?: string;
  digits?: number;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="cr-mono text-faint">--</span>;
  }
  const tone = value > 0 ? "cr-up" : value < 0 ? "cr-down" : "text-muted";
  return <span className={`cr-mono ${tone} ${className}`}>{formatPercent(value, digits)}</span>;
}
