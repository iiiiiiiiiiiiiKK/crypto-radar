import { describe, expect, it } from "vitest";
import { squarify } from "@/features/heatmap/treemap";

describe("squarify", () => {
  it("covers the whole canvas without overlapping tiles", () => {
    const rects = squarify(
      [
        { key: "A", value: 60 },
        { key: "B", value: 30 },
        { key: "C", value: 10 },
      ],
      400,
      200,
    );
    expect(rects).toHaveLength(3);
    const area = rects.reduce((sum, rect) => sum + rect.w * rect.h, 0);
    expect(area).toBeCloseTo(400 * 200, 0);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(-0.001);
      expect(rect.y).toBeGreaterThanOrEqual(-0.001);
    }
  });

  it("drops non positive values", () => {
    const rects = squarify(
      [
        { key: "A", value: 10 },
        { key: "B", value: 0 },
        { key: "C", value: -5 },
      ],
      100,
      100,
    );
    expect(rects.map((rect) => rect.key)).toEqual(["A"]);
  });

  it("returns nothing for an empty canvas", () => {
    expect(squarify([{ key: "A", value: 1 }], 0, 100)).toEqual([]);
    expect(squarify([], 100, 100)).toEqual([]);
  });
});
