export function PercentValue({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="cr-mono text-faint">--</span>;
  }
  const tone = value > 0 ? "cr-up" : value < 0 ? "cr-down" : "text-muted";
  return (
    <span className={`cr-mono ${tone}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}
