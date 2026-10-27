import { useMemo } from "react";
import { isNum } from "@/lib/format";

interface SparklineProps {
  values: number[];
  height?: number;
  color?: "auto" | "up" | "down" | "blue";
  fill?: boolean;
  strokeWidth?: number;
}

/** A dependency-free sparkline: one polyline plus an optional gradient area. */
export function Sparkline({
  values,
  height = 34,
  color = "auto",
  fill = true,
  strokeWidth = 1.4,
}: SparklineProps) {
  const geometry = useMemo(() => {
    const clean = values.filter((value) => isNum(value));
    if (clean.length < 2) return null;
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const span = max - min || 1;
    const width = 100;
    const points = clean.map((value, index) => {
      const x = (index / (clean.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return {
      line: points.join(" "),
      area: `0,${height} ${points.join(" ")} ${width},${height}`,
      up: clean[clean.length - 1] >= clean[0],
    };
  }, [values, height]);

  if (!geometry) {
    return <div className="pulse__spark" aria-hidden="true" />;
  }

  const stroke =
    color === "auto"
      ? geometry.up
        ? "var(--up)"
        : "var(--down)"
      : color === "blue"
        ? "var(--blue)"
        : color === "up"
          ? "var(--up)"
          : "var(--down)";
  const gradientId = `spark-${color}-${height}-${geometry.up ? "u" : "d"}`;

  return (
    <svg
      className="pulse__spark"
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {fill ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={geometry.area} fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <polyline
        points={geometry.line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
