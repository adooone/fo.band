import type { Outline } from './path-outline';

/**
 * The f grows like a fern sprout. Its outline is bound to its centreline
 * (the spine): every outline point is stored as a distance along the spine
 * plus an offset across it, in the spine's local frame. Bending the spine
 * then bends the outline with it, and putting the spine back puts every
 * point back exactly where Figma has it.
 *
 * The stages, over one growth:
 * 1. break ground: the stem pushes out of the earth with a rounded tip;
 * 2. stretch: it grows along the spine, its tip curled into a tight hook
 *    like a fiddlehead;
 * 3. unfurl: once it is tall, the coil slowly opens into the frond of the mark;
 * 4. leaves: the crossbar sprouts from the stem to both sides.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (p: number) => p * p * p * (p * (p * 6 - 15) + 10);

export type Spine = {
  n: number;
  x: Float64Array;
  y: Float64Array;
  /** Half-width of the stroke at each spine point. */
  hw: Float64Array;
  /** Arc length at each spine point. */
  s: Float64Array;
  /** Direction of each segment (unwrapped, so turns add up). */
  theta: Float64Array;
  /** Direction at each point: the mean of its two segments. */
  phi: Float64Array;
  length: number;
  /** Which way the spine turns overall: +1 or −1. */
  turn: 1 | -1;
};

export const buildSpine = (flat: readonly number[]): Spine => {
  const n = flat.length / 3;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const hw = new Float64Array(n);
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = flat[3 * i];
    y[i] = flat[3 * i + 1];
    hw[i] = flat[3 * i + 2];
  }
  const theta = new Float64Array(n - 1);
  for (let k = 0; k < n - 1; k++) {
    let a = Math.atan2(y[k + 1] - y[k], x[k + 1] - x[k]);
    if (k > 0) {
      while (a - theta[k - 1] > Math.PI) a -= 2 * Math.PI;
      while (a - theta[k - 1] < -Math.PI) a += 2 * Math.PI;
    }
    theta[k] = a;
    s[k + 1] = s[k] + Math.hypot(x[k + 1] - x[k], y[k + 1] - y[k]);
  }
  const phi = new Float64Array(n);
  phi[0] = theta[0];
  phi[n - 1] = theta[n - 2];
  for (let i = 1; i < n - 1; i++) phi[i] = (theta[i - 1] + theta[i]) / 2;
  return {
    n,
    x,
    y,
    hw,
    s,
    theta,
    phi,
    length: s[n - 1],
    turn: theta[n - 2] >= theta[0] ? 1 : -1,
  };
};

/** Index of the segment holding arc length `at`, and how far along it (0..1). */
const locate = (spine: Spine, at: number): [number, number] => {
  const { s, n } = spine;
  if (at <= 0) return [0, 0];
  if (at >= spine.length) return [n - 2, 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid] <= at) lo = mid;
    else hi = mid;
  }
  return [lo, (at - s[lo]) / (s[lo + 1] - s[lo] || 1)];
};

export const halfWidthAt = (spine: Spine, at: number): number => {
  const [k, t] = locate(spine, at);
  return spine.hw[k] + (spine.hw[k + 1] - spine.hw[k]) * t;
};

/** Outline points in the spine's frame. */
export type Binding = {
  n: number;
  /** Arc length of the foot on the spine. */
  s: Float64Array;
  /** Offset along the spine's tangent (non-zero only past the ends). */
  a: Float64Array;
  /** Offset across, along the spine's normal. */
  b: Float64Array;
  /** The outline's own normal in the same frame, for the breathing wobble. */
  nT: Float64Array;
  nN: Float64Array;
  /** How much each point belongs to a leaf (the crossbar), 0..1. */
  leaf: Float64Array;
  /** 1 for points of a leaf, including the fillet where it leaves the stem. */
  inLeaf: Uint8Array;
  /**
   * Where each leaf point sits before the leaves sprout: on the straight
   * run of the stem's edge between the points either side of the leaf, as
   * (s, a, b). Zero for points that are not part of a leaf.
   */
  edgeS: Float64Array;
  edgeA: Float64Array;
  edgeB: Float64Array;
};

/** How much an offset across the stem belongs to a leaf rather than the stem. */
const leafWeight = (b: number, h: number) => {
  const q = clamp01((Math.abs(b) - 1.1 * h) / (0.5 * h));
  return q * q * (3 - 2 * q);
};

export const bindOutline = (spine: Spine, o: Outline): Binding => {
  const s = new Float64Array(o.n);
  const a = new Float64Array(o.n);
  const b = new Float64Array(o.n);
  const nT = new Float64Array(o.n);
  const nN = new Float64Array(o.n);
  for (let j = 0; j < o.n; j++) {
    const px = o.x[j];
    const py = o.y[j];
    // The nearest point on the spine polyline.
    let best = Number.POSITIVE_INFINITY;
    let at = 0;
    for (let k = 0; k < spine.n - 1; k++) {
      const ax = spine.x[k];
      const ay = spine.y[k];
      const dx = spine.x[k + 1] - ax;
      const dy = spine.y[k + 1] - ay;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.min(
        1,
        Math.max(0, ((px - ax) * dx + (py - ay) * dy) / l2),
      );
      const d = (px - ax - dx * t) ** 2 + (py - ay - dy * t) ** 2;
      if (d < best) {
        best = d;
        at = spine.s[k] + (spine.s[k + 1] - spine.s[k]) * t;
      }
    }
    const f = frameAt(spine, at, null);
    const ex = px - f.x;
    const ey = py - f.y;
    s[j] = at;
    a[j] = ex * f.tx + ey * f.ty;
    b[j] = ex * f.nx + ey * f.ny;
    nT[j] = o.nx[j] * f.tx + o.ny[j] * f.ty;
    nN[j] = o.nx[j] * f.nx + o.ny[j] * f.ny;
  }
  // The crossbar crosses the stem only around its joint: find the stretch
  // of the spine within a stroke's reach of where the outline sticks out
  // furthest, so the thin ends of the stem and the frond never count as leaves.
  let far = 0;
  for (let j = 1; j < o.n; j++) {
    const h = halfWidthAt(spine, s[j]);
    const hf = halfWidthAt(spine, s[far]);
    if (Math.abs(b[j]) - h > Math.abs(b[far]) - hf && Math.abs(a[j]) < 3)
      far = j;
  }
  const joint = s[far];
  const leaf = new Float64Array(o.n);
  for (let j = 0; j < o.n; j++) {
    const near = clamp01(1 - (Math.abs(s[j] - joint) - 30) / 20);
    leaf[j] = near * leafWeight(b[j], Math.max(10, halfWidthAt(spine, s[j])));
  }
  // Each leaf is a run of points around the outline. Widen the run over the
  // fillets, for as long as the outline still falls toward the stem's edge,
  // and remember the straight edge it covers.
  const n = o.n;
  const at = (j: number) => ((j % n) + n) % n;
  const inLeaf = new Uint8Array(n);
  const edgeS = new Float64Array(n);
  const edgeA = new Float64Array(n);
  const edgeB = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    if (leaf[j] <= 0.01 || inLeaf[j]) continue;
    let first = j;
    let last = j;
    while (leaf[at(first - 1)] > 0.01 && first - 1 > j - n) first--;
    while (leaf[at(last + 1)] > 0.01 && last + 1 < first + n) last++;
    const falls = 0.35;
    while (Math.abs(b[at(first - 1)]) > Math.abs(b[at(first - 2)]) + falls)
      first--;
    while (Math.abs(b[at(last + 1)]) > Math.abs(b[at(last + 2)]) + falls)
      last++;
    const p = at(first - 1);
    const q = at(last + 1);
    const m = last - first + 1;
    for (let i = 0; i < m; i++) {
      const k = at(first + i);
      const t = (i + 1) / (m + 1);
      inLeaf[k] = 1;
      edgeS[k] = s[p] + (s[q] - s[p]) * t;
      edgeA[k] = a[p] + (a[q] - a[p]) * t;
      edgeB[k] = b[p] + (b[q] - b[p]) * t;
    }
  }
  return { n, s, a, b, nT, nN, leaf, inLeaf, edgeS, edgeA, edgeB };
};

type Frame = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
};
const frame: Frame = { x: 0, y: 0, tx: 1, ty: 0, nx: 0, ny: 1 };

/**
 * Position and frame on the spine at arc length `at`. With `bent`, the
 * spine is bent: its points move and every point turns by the bend's extra
 * angle there. Reuses one object; copy what you keep.
 */
const frameAt = (
  spine: Spine,
  at: number,
  bent: { x: Float64Array; y: Float64Array; extra: Float64Array } | null,
): Frame => {
  const [k, t] = locate(spine, at);
  const xs = bent ? bent.x : spine.x;
  const ys = bent ? bent.y : spine.y;
  frame.x = xs[k] + (xs[k + 1] - xs[k]) * t;
  frame.y = ys[k] + (ys[k + 1] - ys[k]) * t;
  const extra = bent
    ? bent.extra[k] + (bent.extra[k + 1] - bent.extra[k]) * t
    : 0;
  const phi = spine.phi[k] + (spine.phi[k + 1] - spine.phi[k]) * t + extra;
  frame.tx = Math.cos(phi);
  frame.ty = Math.sin(phi);
  frame.nx = -frame.ty;
  frame.ny = frame.tx;
  return frame;
};

/** Where the sprout is in its growth, from a 0..1 progress. */
export type SproutPose = {
  /** How much of the spine has grown, in spine units (past the end = fully grown). */
  grown: number;
  /** Extra turn at the tip, radians (the fiddlehead's coil). */
  coil: number;
  /** How far the crossbar leaves have spread, 0..1 (may overshoot a touch). */
  leaves: number;
};

const easeOutBack = (p: number, c1: number) => {
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};

/** Extra spine length past the tip, so the frond's round end is fully out. */
export const OVERGROW = 30;

export const sproutPose = (
  spine: Spine,
  progress: number,
  coilMax: number,
): SproutPose => {
  const p = clamp01(progress);
  const full = spine.length + OVERGROW;
  // Noses out of the ground slowly, stretches, and slows as it reaches its height.
  const g = clamp01(p / 0.62);
  const grown = full * ease(g) ** 0.75;
  const unfurl = ease(clamp01((p - 0.42) / 0.48));
  const leaves = Math.max(0, easeOutBack(clamp01((p - 0.7) / 0.28), 1.6));
  return { grown, coil: coilMax * (1 - unfurl), leaves: p >= 1 ? 1 : leaves };
};

/** Scratch for the bent spine, sized on first use. */
const bent = {
  x: new Float64Array(0),
  y: new Float64Array(0),
  extra: new Float64Array(0),
};

/**
 * Writes the f's outline for a pose into `out` (viewBox units). `wobble(j)`
 * gives each point's breathing offset along the outline's normal.
 */
export const sproutOutline = (
  spine: Spine,
  bound: Binding,
  pose: SproutPose,
  wobble: (j: number) => number,
  out: Float64Array,
): void => {
  const L = pose.grown;
  // The coil lives in the last stretch of what has grown.
  const reach = Math.min(0.55 * L, 170);
  const want = (at: number) => {
    if (pose.coil === 0 || reach <= 0) return 0;
    const q = clamp01((at - (L - reach)) / reach);
    return pose.coil * q * q * (3 - 2 * q);
  };
  if (bent.x.length !== spine.n) {
    bent.x = new Float64Array(spine.n);
    bent.y = new Float64Array(spine.n);
    bent.extra = new Float64Array(spine.n);
  }
  // Add the coil turn by turn along the spine, but never bend tighter than
  // the stroke can take without its inner edge folding over itself.
  bent.x[0] = spine.x[0];
  bent.y[0] = spine.y[0];
  bent.extra[0] = 0;
  for (let k = 0; k < spine.n - 1; k++) {
    const len = spine.s[k + 1] - spine.s[k];
    const own = spine.theta[Math.min(k + 1, spine.n - 2)] - spine.theta[k];
    const limit = len / (1.35 * Math.max(spine.hw[k], spine.hw[k + 1], 4));
    let step = want(spine.s[k + 1]) - want(spine.s[k]);
    step = Math.min(step, Math.max(0, limit - spine.turn * own));
    bent.extra[k + 1] = bent.extra[k] + spine.turn * Math.max(0, step);
    const th = spine.theta[k] + (bent.extra[k] + bent.extra[k + 1]) / 2;
    bent.x[k + 1] = bent.x[k] + len * Math.cos(th);
    bent.y[k + 1] = bent.y[k] + len * Math.sin(th);
  }

  // The growing tip is a round cap of the stroke's own half-width.
  const r = Math.max(7, halfWidthAt(spine, Math.min(L, spine.length)));
  const leaves = pose.leaves;
  for (let j = 0; j < bound.n; j++) {
    let s = bound.s[j];
    let a0 = bound.a[j];
    let b = bound.b[j];
    if (bound.inLeaf[j]) {
      // Leaves: before they sprout, every point of the crossbar lies on the
      // stem's own edge, so the stem is smooth; then they spread out of it,
      // settling with a touch of overshoot.
      const w = 1 - leaves;
      s += (bound.edgeS[j] - s) * w;
      a0 += (bound.edgeA[j] - a0) * w;
      b += (bound.edgeB[j] - b) * w;
    }
    let along = s;
    let a = a0;
    const sigma = s + a0;
    if (sigma > L - r) {
      // Past the growing tip: fold onto the round cap.
      const c = (Math.min(1, (sigma - (L - r)) / r) * Math.PI) / 2;
      const cap = Math.max(0, L - r) + r * Math.sin(c);
      along = Math.min(cap, spine.length);
      a = cap - along;
      b *= Math.cos(c);
    }
    const d = wobble(j);
    a += d * bound.nT[j];
    b += d * bound.nN[j];
    const f = frameAt(spine, along, bent);
    out[2 * j] = f.x + a * f.tx + b * f.nx;
    out[2 * j + 1] = f.y + a * f.ty + b * f.ny;
  }
};
