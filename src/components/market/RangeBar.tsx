/**
 * A thin bar that shows where the current price sits between the 24 h low and
 * high. It gives every row an instant visual read without a sparkline query.
 */
export function RangeBar({
  low,
  high,
  price,
  className = "",
}: {
  low: number | null;
  high: number | null;
  price: number;
  className?: string;
}) {
  if (low === null || high === null || !Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return <span className={`block h-[3px] rounded-full bg-line ${className}`} aria-hidden />;
  }
  const position = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
  const rising = price >= (low + high) / 2;
  return (
    <span
      className={`relative block h-[3px] rounded-full bg-line overflow-hidden ${className}`}
      aria-hidden
    >
      <span
        className="absolute inset-y-0 left-0 bg-line"
        style={{ width: `${position}%` }}
      />
      <span
        className={`absolute top-1/2 h-[7px] w-[2px] -translate-y-1/2 rounded-full ${
          rising ? "bg-up" : "bg-down"
        }`}
        style={{ left: `calc(${position}% - 1px)` }}
      />
    </span>
  );
}
