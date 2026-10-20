/**
 * Turns an SVG path (absolute M, L, C, Z, which is all the mark uses) into a
 * closed polygon, and gives such a polygon outward normals and arc length,
 * so it can be displaced by noise like the forest's shapes.
 */

export type Outline = {
  n: number;
  x: Float64Array;
  y: Float64Array;
  /** Outward unit normals. */
  nx: Float64Array;
  ny: Float64Array;
  /** Arc length from the first point. */
  s: Float64Array;
  length: number;
};

/** Samples a path's curves into a flat [x, y, …] polygon (`segments` per curve). */
export const flattenPath = (d: string, segments = 14): number[] => {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const pts: number[] = [];
  let cmd = '';
  let i = 0;
  let cx = 0;
  let cy = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[MLCZ]$/i.test(t)) {
      cmd = t.toUpperCase();
      i++;
      if (cmd === 'Z') continue;
    }
    if (cmd === 'M' || cmd === 'L') {
      cx = num();
      cy = num();
      pts.push(cx, cy);
    } else if (cmd === 'C') {
      const x1 = num();
      const y1 = num();
      const x2 = num();
      const y2 = num();
      const x3 = num();
      const y3 = num();
      for (let k = 1; k <= segments; k++) {
        const u = k / segments;
        const v = 1 - u;
        pts.push(
          v * v * v * cx +
            3 * v * v * u * x1 +
            3 * v * u * u * x2 +
            u * u * u * x3,
          v * v * v * cy +
            3 * v * v * u * y1 +
            3 * v * u * u * y2 +
            u * u * u * y3,
        );
      }
      cx = x3;
      cy = y3;
    } else {
      i++;
    }
  }
  // Drop a closing point that repeats the first.
  if (
    pts.length >= 4 &&
    Math.abs(pts[0] - pts[pts.length - 2]) < 1e-6 &&
    Math.abs(pts[1] - pts[pts.length - 1]) < 1e-6
  )
    pts.length -= 2;
  return pts;
};

/** Normals and arc length for a closed polygon; outward for a clockwise path (y down). */
export const outlineOf = (poly: number[]): Outline => {
  const n = poly.length / 2;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  const s = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    x[j] = poly[2 * j];
    y[j] = poly[2 * j + 1];
  }
  // Which way the polygon winds decides which side is out.
  let area = 0;
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    area += x[j] * y[k] - x[k] * y[j];
  }
  const sign = area > 0 ? 1 : -1;
  let length = 0;
  for (let j = 0; j < n; j++) {
    const p = (j + n - 1) % n;
    const q = (j + 1) % n;
    const dx = x[q] - x[p];
    const dy = y[q] - y[p];
    const l = Math.hypot(dx, dy) || 1;
    nx[j] = (sign * dy) / l;
    ny[j] = (-sign * dx) / l;
    s[j] = length;
    length += Math.hypot(x[q] - x[j], y[q] - y[j]);
  }
  return { n, x, y, nx, ny, s, length };
};
