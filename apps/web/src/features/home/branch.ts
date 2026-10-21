import { clamp01, ease } from './easing';
import { type LeafKind, leafShape } from './forms';
import { mulberry32 } from './rng';

/**
 * The branch of the tree the land turns into on the finds page: a limb
 * built from a skeleton, the way a real one grows. The main branch leaves
 * the trunk rising, flaring out of it like a shoulder, arches under its
 * own weight and turns up again at the tip, tapering all the way.
 * Children fork off it in turn on the sky side and the ground side at
 * acute angles, carry on its curve and fork again near their ends; leaves
 * cluster on the last limbs in alternate rows on short stalks, smaller
 * toward every tip, one leaf at each end.
 *
 * Everything knows when it grows: a limb has a window of the whole growth
 * (0..1) and extends along its own centreline through it as a thin shoot
 * that thickens as it lengthens; its children start as it reaches them,
 * leaves unfurl last. The branch is added to the land's own path, so the
 * whole tree is one fill without a seam.
 */

type Vec = { x: number; y: number };

export type Limb = {
  /** The centreline, in screen px. */
  x: Float64Array;
  y: Float64Array;
  /** Half-width at each centreline point, fully grown. */
  w: Float64Array;
  n: number;
  /** Arc length at each point. */
  s: Float64Array;
  /** Start and length of its growth window, 0..1 of the whole. */
  start: number;
  span: number;
};

export type BranchLeaf = {
  x: number;
  y: number;
  /** Which way the stalk points (unit). */
  ux: number;
  uy: number;
  /** Height of the leaf, px. */
  size: number;
  start: number;
  span: number;
  seed: number;
};

export type Branch = { limbs: Limb[]; leaves: BranchLeaf[] };

const unit = (x: number, y: number): Vec => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
/** Turns `v` by `a` radians: toward the sky for a vector pointing left (y down). */
const turn = (v: Vec, a: number): Vec => ({
  x: v.x * Math.cos(a) - v.y * Math.sin(a),
  y: v.x * Math.sin(a) + v.y * Math.cos(a),
});
const cubic = (p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec => {
  const u = 1 - t;
  return {
    x:
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x,
    y:
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y,
  };
};

/**
 * Samples a cubic into a centreline with a hand's waver across it, fading
 * toward the base so the limb joins its parent cleanly.
 */
const sampleCurve = (
  p0: Vec,
  p1: Vec,
  p2: Vec,
  p3: Vec,
  n: number,
  waver: number,
  phase: number,
): Vec[] => {
  const pts: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = cubic(p0, p1, p2, p3, t);
    const a = cubic(p0, p1, p2, p3, Math.max(0, t - 0.01));
    const b = cubic(p0, p1, p2, p3, Math.min(1, t + 0.01));
    const d = unit(b.x - a.x, b.y - a.y);
    const off =
      waver *
      (Math.sin(5.3 * t + phase) + 0.45 * Math.sin(11.7 * t + 2 * phase)) *
      Math.min(1, t * 3);
    pts.push({ x: c.x - d.y * off, y: c.y + d.x * off });
  }
  return pts;
};

/** Builds a limb from centreline points and a width profile over 0..1. */
const limbOf = (
  pts: Vec[],
  width: (t: number) => number,
  start: number,
  span: number,
): Limb => {
  const n = pts.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const w = new Float64Array(n);
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = pts[i].x;
    y[i] = pts[i].y;
    w[i] = width(i / (n - 1));
    if (i > 0) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  }
  return { x, y, w, n, s, start, span };
};

/** The point, tangent (toward the tip) and half-width at `t` (0..1) of a limb. */
const along = (limb: Limb, t: number) => {
  const f = t * (limb.n - 1);
  const i = Math.min(limb.n - 2, Math.max(0, Math.floor(f)));
  const k = f - i;
  const x = limb.x[i] + (limb.x[i + 1] - limb.x[i]) * k;
  const y = limb.y[i] + (limb.y[i + 1] - limb.y[i]) * k;
  const d = unit(limb.x[i + 1] - limb.x[i], limb.y[i + 1] - limb.y[i]);
  return { x, y, d, w: limb.w[i] + (limb.w[i + 1] - limb.w[i]) * k };
};

/**
 * Lays out the branch for a screen: the trunk's left edge is at `left`,
 * the branch leaves it `y0` down from the top and reaches `reach` left.
 */
export const buildBranch = (
  left: number,
  y0: number,
  reach: number,
  H: number,
  W: number,
  seed: number,
): Branch => {
  const rng = mulberry32(Math.floor(seed * 7919) + 53);
  const jitter = (k: number) => (rng() - 0.5) * 2 * k;
  const limbs: Limb[] = [];
  const leaves: BranchLeaf[] = [];
  const UP: Vec = { x: 0, y: -1 };
  const tipWidth = Math.max(0.9, 0.0022 * W);

  /** Leaves along a limb from `from` to its tip in alternate rows, and one at the end. */
  const leafRow = (
    limb: Limb,
    from: number,
    step: number,
    size: number,
    firstSide: 1 | -1,
  ) => {
    let side = firstSide;
    for (let t = from; t < 0.94; t += step * (0.85 + 0.3 * rng())) {
      const at = along(limb, t);
      const r = turn(at.d, (side * Math.PI) / 2);
      const u = turn(at.d, side * (0.95 + 0.35 * rng()));
      leaves.push({
        x: at.x + r.x * at.w * 0.8,
        y: at.y + r.y * at.w * 0.8,
        ux: u.x,
        uy: u.y,
        size: size * (1 - 0.3 * t) * (0.85 + 0.3 * rng()),
        start: limb.start + limb.span * Math.min(1, t + 0.06),
        span: 0.24,
        seed: rng() * 100,
      });
      side = side === 1 ? -1 : 1;
    }
    const tip = along(limb, 1);
    leaves.push({
      x: tip.x,
      y: tip.y,
      ux: tip.d.x,
      uy: tip.d.y,
      size: size * 0.75,
      start: limb.start + limb.span,
      span: 0.24,
      seed: rng() * 100,
    });
  };

  /**
   * A child forking off `parent` at `t`, turned `angle` from the parent's
   * tangent (positive toward the sky), `len` long: it carries the parent's
   * direction on, bends a touch with its own weight and turns up at the
   * tip. Bigger children fork again near their ends, on both sides.
   */
  const fork = (
    parent: Limb,
    t: number,
    angle: number,
    len: number,
    depth: number,
  ) => {
    const at = along(parent, t);
    const d = turn(at.d, angle);
    const lift = angle > 0 ? 0.16 : 0.06;
    const q0 = { x: at.x, y: at.y };
    const q1 = { x: at.x + d.x * len * 0.42, y: at.y + d.y * len * 0.42 };
    const q2 = {
      x: at.x + d.x * len * 0.8 + UP.x * lift * 0.5 * len,
      y: at.y + d.y * len * 0.8 + UP.y * lift * 0.5 * len,
    };
    const q3 = {
      x: at.x + d.x * len + UP.x * lift * len,
      y: at.y + d.y * len + UP.y * lift * len,
    };
    const pts = sampleCurve(q0, q1, q2, q3, 18, 0.02 * len, rng() * 6);
    const wb = at.w * 0.62;
    const width = (u: number) => tipWidth + (wb - tipWidth) * (1 - u) ** 0.9;
    const span = depth === 1 ? 0.3 : 0.2;
    const limb = limbOf(pts, width, parent.start + parent.span * t, span);
    limbs.push(limb);
    if (depth < 2 && len > 0.09 * W) {
      // A fork near the end: one shoot on, one off to the other side.
      fork(limb, 0.6, 0.4 + jitter(0.08), len * 0.45, depth + 1);
      fork(limb, 0.78, -0.4 + jitter(0.08), len * 0.36, depth + 1);
      leafRow(limb, 0.82, 0.1, 0.05 * H, 1);
    } else {
      leafRow(limb, 0.4, 0.17, 0.05 * H, angle > 0 ? -1 : 1);
    }
    return limb;
  };

  // The main branch: a shoulder out of the trunk, rising, arching, tip up.
  const p0 = { x: left + 0.03 * W, y: y0 + 0.02 * H };
  const p1 = { x: left - 0.2 * reach, y: y0 - 0.08 * H + jitter(0.01 * H) };
  const p2 = { x: left - 0.62 * reach, y: y0 + jitter(0.012 * H) };
  const p3 = { x: left - reach, y: y0 - 0.055 * H };
  const mainPts = sampleCurve(p0, p1, p2, p3, 48, 0.011 * reach, rng() * 6);
  const w0 = 0.019 * W;
  const mainWidth = (t: number) =>
    tipWidth +
    (w0 - tipWidth) * (1 - t) ** 1.15 +
    w0 * 1.6 * Math.max(0, 1 - t / 0.1) ** 2;
  const main = limbOf(mainPts, mainWidth, 0, 0.5);
  limbs.push(main);

  // Children in turn on the sky side and the ground side, shorter outward.
  fork(main, 0.2, 0.36 + jitter(0.06), reach * 0.3, 1);
  fork(main, 0.36, -0.36 + jitter(0.06), reach * 0.2, 1);
  fork(main, 0.52, 0.34 + jitter(0.06), reach * 0.24, 1);
  fork(main, 0.68, -0.32 + jitter(0.06), reach * 0.15, 1);
  fork(main, 0.82, 0.32 + jitter(0.06), reach * 0.16, 1);
  leafRow(main, 0.88, 0.06, 0.045 * H, -1);

  return { limbs, leaves };
};

/** Eases out and settles, with a touch of give (no more than 3% past). */
const settle = (p: number) => {
  const c1 = 0.5;
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};

/**
 * Adds a closed polygon to the path, wound the same way as the land (a
 * positive shoelace sum), so the fill's nonzero rule unites it with the
 * land instead of cutting a hole.
 */
const addPolygon = (
  ctx: CanvasRenderingContext2D,
  pts: number[],
  smooth: boolean,
) => {
  const n = pts.length / 2;
  if (n < 3) return;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1];
  }
  const at = (i: number) => {
    const k = area >= 0 ? i % n : (n - (i % n)) % n;
    return [pts[2 * k], pts[2 * k + 1]] as const;
  };
  if (smooth) {
    const [ax, ay] = at(0);
    const [bx, by] = at(1);
    ctx.moveTo((ax + bx) / 2, (ay + by) / 2);
    for (let i = 1; i <= n; i++) {
      const [cx, cy] = at(i);
      const [dx, dy] = at(i + 1);
      ctx.quadraticCurveTo(cx, cy, (cx + dx) / 2, (cy + dy) / 2);
    }
  } else {
    const [x0, y0] = at(0);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < n; i++) {
      const [x, y] = at(i);
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
};

/**
 * Adds the branch grown `g` of the way (0 none, 1 whole) to the current
 * path, to be filled with the land: every limb as the part of its
 * centreline that has grown, a thin shoot that thickens toward its final
 * width and tapers to its growing tip; every leaf once its limb has
 * reached it, unfurling from its stalk.
 */
export const addBranch = (
  ctx: CanvasRenderingContext2D,
  branch: Branch,
  g: number,
) => {
  if (g <= 0) return;
  for (const limb of branch.limbs) {
    const p = ease(clamp01((g - limb.start) / limb.span));
    if (p <= 0.01) continue;
    const total = limb.s[limb.n - 1];
    const grown = p * total;
    const thick = p ** 0.6;
    let last = 0;
    while (last + 1 < limb.n && limb.s[last + 1] <= grown) last++;
    const span = limb.s[last + 1] - limb.s[last] || 1;
    const k = last + 1 < limb.n ? clamp01((grown - limb.s[last]) / span) : 0;
    const tipX = limb.x[last] + (limb.x[last + 1] - limb.x[last]) * k;
    const tipY = limb.y[last] + (limb.y[last + 1] - limb.y[last]) * k;
    /** Half-width at arc length `s` while growing: thinner toward the young tip. */
    const widthAt = (w: number, s: number) => {
      const u = grown > 0 ? s / grown : 0;
      return Math.max(0.6, w * thick * (1 - 0.85 * (1 - p) * u * u));
    };
    const tipW = widthAt(
      limb.w[last] + (limb.w[last + 1] - limb.w[last]) * k,
      grown,
    );
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i <= last; i++) {
      const j = Math.min(limb.n - 1, i + 1);
      const h = Math.max(0, i - 1);
      const d = unit(limb.x[j] - limb.x[h], limb.y[j] - limb.y[h]);
      const w = widthAt(limb.w[i], limb.s[i]);
      left.push(limb.x[i] - d.y * w, limb.y[i] + d.x * w);
      right.push(limb.x[i] + d.y * w, limb.y[i] - d.x * w);
    }
    // One side out, round the tip, the other side back.
    const d = unit(tipX - limb.x[last], tipY - limb.y[last]);
    const poly: number[] = [...left];
    for (let q = 0; q <= 6; q++) {
      const a = (Math.PI * q) / 6;
      poly.push(
        tipX - d.y * tipW * Math.cos(a) + d.x * tipW * Math.sin(a),
        tipY + d.x * tipW * Math.cos(a) + d.y * tipW * Math.sin(a),
      );
    }
    for (let i = right.length - 2; i >= 0; i -= 2) {
      poly.push(right[i], right[i + 1]);
    }
    addPolygon(ctx, poly, false);
  }
  for (const leaf of branch.leaves) {
    const q = clamp01((g - leaf.start) / leaf.span);
    if (q <= 0) continue;
    const scale = settle(q) * leaf.size;
    // Simple blades only: a lobed oak leaf turns to mush this small.
    const kind: LeafKind = (['birch', 'aspen', 'willow'] as const)[
      Math.floor(leaf.seed) % 3
    ];
    const shape = leafShape(leaf.seed, 1, kind);
    const r = { x: -leaf.uy, y: leaf.ux };
    const poly: number[] = [];
    for (let j = 0; j < shape.length; j += 2) {
      const lx = shape[j] * scale;
      const ly = shape[j + 1] * scale;
      poly.push(
        leaf.x + lx * r.x - ly * leaf.ux,
        leaf.y + lx * r.y - ly * leaf.uy,
      );
    }
    addPolygon(ctx, poly, true);
  }
};
