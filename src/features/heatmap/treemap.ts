export interface TreemapInput {
  key: string;
  value: number;
}

export interface TreemapRect extends TreemapInput {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Squarified treemap (Bruls, Huizing, van Wijk).
 *
 * Values are laid out so the tiles stay as close to squares as possible, which
 * keeps the result readable. The market heatmap uses the 24 h turnover as the
 * tile area.
 */
export function squarify(
  items: TreemapInput[],
  width: number,
  height: number,
): TreemapRect[] {
  const positive = items.filter((item) => item.value > 0 && Number.isFinite(item.value));
  if (positive.length === 0 || width <= 0 || height <= 0) return [];

  const total = positive.reduce((sum, item) => sum + item.value, 0);
  const scale = (width * height) / total;
  const sorted = [...positive]
    .map((item) => ({ ...item, area: item.value * scale }))
    .sort((a, b) => b.area - a.area);

  const result: TreemapRect[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let index = 0;

  while (index < sorted.length) {
    const shortSide = Math.min(w, h);
    let rowLength = 1;
    let bestRatio = Number.POSITIVE_INFINITY;

    while (index + rowLength <= sorted.length) {
      const row = sorted.slice(index, index + rowLength);
      const areaSum = row.reduce((sum, item) => sum + item.area, 0);
      const thickness = areaSum / shortSide;
      let worst = 0;
      for (const item of row) {
        const side = item.area / thickness;
        const ratio = Math.max(thickness / side, side / thickness);
        if (ratio > worst) worst = ratio;
      }
      if (worst <= bestRatio) {
        bestRatio = worst;
        rowLength += 1;
      } else {
        break;
      }
    }

    rowLength -= 1;
    if (rowLength < 1) rowLength = 1;

    const row = sorted.slice(index, index + rowLength);
    const areaSum = row.reduce((sum, item) => sum + item.area, 0);
    const horizontal = w >= h;
    const thickness = Math.min(areaSum / shortSide, horizontal ? w : h);

    let offset = 0;
    for (const item of row) {
      const length = item.area / thickness;
      if (horizontal) {
        result.push({ key: item.key, value: item.value, x, y: y + offset, w: thickness, h: length });
      } else {
        result.push({ key: item.key, value: item.value, x: x + offset, y, w: length, h: thickness });
      }
      offset += length;
    }

    if (horizontal) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
    index += rowLength;
  }

  return result;
}
