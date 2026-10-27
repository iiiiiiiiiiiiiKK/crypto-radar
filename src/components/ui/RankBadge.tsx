/** Pixel rank plate: gold, silver, bronze, then neutral. */
export function RankBadge({ rank }: { rank: number }) {
  const tone = rank === 1 ? "rank-1" : rank === 2 ? "rank-2" : rank === 3 ? "rank-3" : "";
  return (
    <span className={`rank-badge ${tone}`} aria-label={`rank ${rank}`}>
      {rank}
    </span>
  );
}
