/**
 * Pixel avatars rendered with CSS only.
 *
 * Each avatar is an 8x8 bitmap encoded as 8 hex nibbles per row, which keeps
 * the component dependency free and crisp at any size.
 */
export const AVATARS = ["radar", "bull", "bear", "alien", "ghost", "degen"] as const;
export type AvatarId = (typeof AVATARS)[number];

const BITMAPS: Record<string, string[]> = {
  radar: [
    "00111100",
    "01000010",
    "10011001",
    "10111101",
    "10111101",
    "10011001",
    "01000010",
    "00111100",
  ],
  bull: [
    "11000000",
    "11100000",
    "01111110",
    "01111110",
    "00111100",
    "00111100",
    "00011000",
    "00011000",
  ],
  bear: [
    "00011000",
    "00111100",
    "01111110",
    "01111110",
    "01111110",
    "00111100",
    "01000010",
    "10000001",
  ],
  alien: [
    "00111100",
    "01111110",
    "11111111",
    "11011011",
    "11111111",
    "01111110",
    "00100100",
    "01000010",
  ],
  ghost: [
    "00111100",
    "01111110",
    "11111111",
    "11011011",
    "11111111",
    "11111111",
    "11011011",
    "10000001",
  ],
  degen: [
    "00111100",
    "01111110",
    "11100111",
    "11111111",
    "11011011",
    "11111111",
    "01000010",
    "00100100",
  ],
};

export function Avatar({ id, size = 48 }: { id: string; size?: number }) {
  const bitmap = BITMAPS[id] ?? BITMAPS.radar;
  const cell = size / 8;
  return (
    <span
      className="inline-grid shrink-0"
      style={{
        gridTemplateColumns: `repeat(8, ${cell}px)`,
        gridTemplateRows: `repeat(8, ${cell}px)`,
        width: size,
        height: size,
        background: "#07080d",
        boxShadow: "inset 0 0 0 1px #232a3d",
      }}
      aria-hidden
    >
      {bitmap.flatMap((row, y) =>
        row.split("").map((pixel, x) => (
          <span
            key={`${x}-${y}`}
            style={{
              background: pixel === "1" ? "#39ff88" : "transparent",
              boxShadow: pixel === "1" ? "0 0 4px rgba(57,255,136,0.35)" : undefined,
            }}
          />
        )),
      )}
    </span>
  );
}
