import { createNoise2D } from 'simplex-noise';
import {
  LOGO_F,
  LOGO_F_SPINE,
  LOGO_O,
  LOGO_ROOT,
  LOGO_VIEWBOX,
} from './logo-paths';
import { flattenPath, type Outline, outlineOf } from './path-outline';
import { bindOutline, buildSpine, sproutOutline, sproutPose } from './sprout';

/**
 * The forest: the lower part of the screen is ink, the sky above is paper,
 * and the edge between them is one continuous line, as if drawn without
 * lifting the pencil. It runs along a wavy ground of hills, highest in the
 * middle under the mark, with a ripple of grass that moves with the wind,
 * and at every tree it climbs the outline, goes over the crown and comes
 * back down: round and oval crowns on short trunks, soft spruces, bushes,
 * each standing on its own. Every outline has as many points as a plain
 * mound, so on load the forest morphs out of a flat line: the hills swell,
 * the line bulges into mounds and each mound grows into its tree, from the
 * middle outward. The line wobbles a touch like a pencil stroke, trees lean
 * with a wind that drifts and gusts, the ground breathes.
 */

const TAU = Math.PI * 2;

export type TreeKind = 'round' | 'oval' | 'spruce' | 'bush';

export type ForestOptions = {
  /** The ground's resting height at the screen edges, fraction of the height from the top. */
  horizon: number;
  /** How much the ground rises toward the middle, fraction of the height. */
  hill: number;
  /** Smaller waves along the ground, fraction of the height. */
  waves: number;
  /** How many of those smaller waves fit across the screen. */
  waveCount: number;
  /** Tallest tree, as a fraction of the mark's height. */
  treeMax: number;
  /** Smallest tree, as a fraction of the tallest. */
  treeMin: number;
  /** Gap between neighbouring trees, in mean tree widths. */
  gap: number;
  /** Half-width of the clearing in the middle, fraction of the width (at least the mark's). */
  clearing: number;
  /** Share of spruces among the trees, 0..1. */
  spruces: number;
  /** Bushes per tree. */
  bushes: number;
  /** Trunk height of round trees, fraction of the tree. */
  trunk: number;
  /** Grass ripple amplitude in design px (1 at 1024 px tall). */
  grassAmp: number;
  /** Grass ripple wavelength in design px. */
  grassWavelength: number;
  /** How fast the grass ripple travels, wavelengths per second. */
  grassSpeed: number;
  /** Wind strength multiplier. */
  wind: number;
  /** Seconds between two gusts of wind. */
  gustEvery: number;
  /** How long a gust takes to cross the screen. */
  gustSeconds: number;
  /** Seconds of one breath of the whole forest. */
  breathSeconds: number;
  /** Hand-drawn wobble amplitude in design px. */
  wobble: number;
  /** How long the morph from the flat line takes, per tree. */
  morphSeconds: number;
  /** Extra delay for the trees at the edges, seconds. */
  morphStagger: number;
  /** Seed for the forest, so it is the same forest on every visit. */
  seed: number;
};

export const DEFAULT_OPTIONS: ForestOptions = {
  horizon: 0.71,
  hill: 0.055,
  waves: 0.005,
  waveCount: 7.1,
  treeMax: 0.21,
  treeMin: 0.3,
  gap: 0.35,
  clearing: 0,
  spruces: 0.55,
  bushes: 0,
  trunk: 0.16,
  grassAmp: 2.4,
  grassWavelength: 10,
  grassSpeed: 0,
  wind: 3,
  gustEvery: 5,
  gustSeconds: 7,
  breathSeconds: 12,
  wobble: 3.3,
  morphSeconds: 1.4,
  morphStagger: 1.3,
  seed: 25,
};

/** Deterministic PRNG so the forest keeps its shape between visits. */
export const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Smootherstep: zero velocity and acceleration at both ends. */
const ease = (p: number) => p * p * p * (p * (p * 6 - 15) + 10);
/** Raised-cosine bump, 1 at the centre and 0 beyond ±1. */
export const bump = (u: number): number =>
  u <= -1 || u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * u);

/** Points per tree outline; the mound has the same count, so they can morph. */
export const POINTS = 72;

/**
 * Resamples a closed polygon (flat [x, y, …]) to `count` points evenly
 * spaced by arc length, starting at its first point.
 */
export const resample = (poly: number[], count: number): number[] => {
  const n = poly.length / 2;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    cum[i + 1] =
      cum[i] +
      Math.hypot(poly[2 * j] - poly[2 * i], poly[2 * j + 1] - poly[2 * i + 1]);
  }
  const length = cum[n];
  const out: number[] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * length;
    while (seg + 1 < n && cum[seg + 1] <= target) seg++;
    const j = (seg + 1) % n;
    const span = cum[seg + 1] - cum[seg] || 1;
    const t = (target - cum[seg]) / span;
    out.push(
      poly[2 * seg] + (poly[2 * j] - poly[2 * seg]) * t,
      poly[2 * seg + 1] + (poly[2 * j + 1] - poly[2 * seg + 1]) * t,
    );
  }
  return out;
};

/**
 * Resamples an open polyline (flat [x, y, …]) to `count` points evenly
 * spaced by arc length, from its first point to its last, both included.
 */
export const resampleOpen = (poly: number[], count: number): number[] => {
  const n = poly.length / 2;
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    cum[i] =
      cum[i - 1] +
      Math.hypot(
        poly[2 * i] - poly[2 * i - 2],
        poly[2 * i + 1] - poly[2 * i - 1],
      );
  }
  const length = cum[n - 1];
  const out: number[] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / (count - 1)) * length;
    while (seg + 2 < n && cum[seg + 1] <= target) seg++;
    const span = cum[seg + 1] - cum[seg] || 1;
    const t = Math.min(1, (target - cum[seg]) / span);
    out.push(
      poly[2 * seg] + (poly[2 * seg + 2] - poly[2 * seg]) * t,
      poly[2 * seg + 1] + (poly[2 * seg + 3] - poly[2 * seg + 1]) * t,
    );
  }
  return out;
};

export type Tree = {
  kind: TreeKind;
  /** Position across the screen in CSS px. */
  x: number;
  /** Height in CSS px. */
  h: number;
  /** Width in CSS px. */
  w: number;
  seed: number;
  /** Seconds before this tree starts morphing. */
  delay: number;
  /**
   * The final outline as an open path from the left end of the base, up and
   * over, to the right end (local units: 1 tall, base at the origin, y up is
   * negative). The ground line it is spliced into closes it.
   */
  shape: number[];
  /** The plain mound it morphs from, same point count and ends. */
  mound: number[];
};

/**
 * A tree's outline in local units, one smooth open path that starts at the
 * base's left end and goes up and over to the right end; the ground line
 * closes it. Crowns are blobs (a circle with soft lobes), spruces are blunt
 * cones with soft bulges, bushes are low blobs.
 */
export const treeShape = (
  kind: TreeKind,
  w: number,
  seed: number,
  trunk: number,
  blobNoise: (x: number, y: number) => number,
): number[] => {
  const pts: number[] = [];
  const push = (x: number, y: number) => pts.push(x, y);
  const blob = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    from: number,
    to: number,
    lobes: number,
  ) => {
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      const r =
        1 +
        lobes * blobNoise(1.1 * Math.cos(a) + seed, 1.1 * Math.sin(a) + seed);
      push(cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a));
    }
  };
  const deg = Math.PI / 180;
  switch (kind) {
    case 'round':
    case 'oval': {
      // A crown on a short, stout stub of a trunk that flares out at the
      // ground, like a cartoon tree, not a stick. The crown closes where its
      // edge meets the trunk, so its underside stays round.
      const ry = (1 - trunk) / 2;
      const rx = kind === 'round' ? ry * 1.08 : ry * 0.8;
      const top = 0.085;
      const foot = 0.13;
      const cy = -(1 - ry);
      const join = Math.acos(Math.min(0.95, top / rx));
      push(-foot, 0);
      push(-top * 1.05, -trunk * 0.45);
      blob(0, cy, rx, ry, Math.PI - join, TAU + join, 0.025);
      push(top * 1.05, -trunk * 0.45);
      push(foot, 0);
      return pts;
    }
    case 'spruce': {
      // A blunt cone straight from the ground, no trunk, sides bulging softly.
      const n = 28;
      const side = (t: number) => {
        const bulge =
          1 + 0.06 * (0.5 + 0.5 * Math.sin(5 * Math.PI * t - Math.PI / 2));
        return (w / 2) * (1 - t) ** 0.7 * bulge;
      };
      for (let i = 0; i <= n; i++) push(-side(i / n), -i / n);
      for (let i = n; i >= 0; i--) push(side(i / n), -i / n);
      return pts;
    }
    default: {
      push(-w / 2, 0);
      blob(0, -0.45, w / 2, 0.55, 150 * deg, 390 * deg, 0.08);
      push(w / 2, 0);
      return pts;
    }
  }
};

/** The plain mound every tree starts as: a low half-ellipse on the ground. */
export const moundShape = (w: number): number[] => {
  const pts: number[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (Math.PI * i) / n;
    pts.push((w / 2) * Math.cos(a), 0.12 * Math.sin(a));
  }
  return pts;
};

export type ForestLayout = {
  width: number;
  height: number;
  /** Where the sprout's stem meets the ground, in CSS px. */
  root: { x: number; y: number };
};

export type ForestRenderer = {
  resize: (width: number, height: number, dpr: number) => void;
  draw: (time: number) => void;
  /** Updates options in place; the forest is replanted when its layout changes. */
  setOptions: (options: Partial<ForestOptions>) => void;
  /** Updates the mark's size and the o's place, which set the clearing and the root. */
  setMark: (mark: MarkOptions) => void;
  /** Plays the intro again: the forest morphs out of the line, the f sprouts. */
  restart: () => void;
  /** Sends a gust across the forest from the left (+1) or the right (−1). */
  gust: (direction: 1 | -1) => void;
  /** Wind strength at a screen x right now, about −1..1 (positive blows right). */
  windAt: (x: number) => number;
  layout: () => ForestLayout;
};

export const INK = '#2d493a';
export const PAPER = '#f7f6f1';

/** The mark's height for a screen: a third of the height, less on narrow phones. */
export const logoHeight = (
  width: number,
  height: number,
  fraction = 0.34,
): number => Math.min(fraction * height, 0.55 * width);
/** The mark's width for that height. */
export const logoWidth = (height: number, shift: number): number =>
  height * ((LOGO_VIEWBOX.w + shift) / LOGO_VIEWBOX.h);

export type MarkOptions = {
  /** The mark's height as a fraction of the screen height. */
  logo: number;
  /** Where the o settles relative to Figma, viewBox units up and right. */
  oLift: number;
  oShift: number;
  /** The o's size relative to Figma. */
  oScale: number;
  /** Breathing of the mark's outline: wobble amplitude in design px, and the breath's period. */
  markWobble: number;
  markBreath: number;
  /** How long the f takes to sprout, grow, unfurl and put out its leaves. */
  sproutSeconds: number;
  /** How tightly the young sprout's tip is coiled, radians of extra turn. */
  coil: number;
};

export const DEFAULT_MARK: MarkOptions = {
  logo: 0.35,
  oLift: 34,
  oShift: -18,
  oScale: 0.78,
  markWobble: 1.2,
  markBreath: 6,
  sproutSeconds: 5,
  coil: 3,
};

/** The mark's outlines in viewBox units, evenly resampled so they can breathe. */
const MARK_F: Outline = outlineOf(resample(flattenPath(LOGO_F), 260));
const MARK_O: Outline = outlineOf(resample(flattenPath(LOGO_O), 110));
const oCentre = (() => {
  let x = 0;
  let y = 0;
  for (let j = 0; j < MARK_O.n; j++) {
    x += MARK_O.x[j];
    y += MARK_O.y[j];
  }
  return { x: x / MARK_O.n, y: y / MARK_O.n };
})();
const F_SPINE = buildSpine(LOGO_F_SPINE);
const F_BOUND = bindOutline(F_SPINE, MARK_F);
/** The sprout starts once the ground has begun to swell. */
const SPROUT_DELAY = 0.6;
/** The o rises when the sprout is this far along, and takes this long. */
const O_RISE_AT = 0.55;
const O_RISE_SECONDS = 3;

/**
 * Traces a closed polygon through the midpoints of its edges with quadratic
 * curves, so every corner comes out rounded.
 */
const traceSmooth = (
  target: CanvasRenderingContext2D,
  buf: Float64Array,
  n: number,
) => {
  const mx = (buf[0] + buf[2]) / 2;
  const my = (buf[1] + buf[3]) / 2;
  target.moveTo(mx, my);
  for (let j = 1; j <= n; j++) {
    const a = j % n;
    const b = (j + 1) % n;
    target.quadraticCurveTo(
      buf[2 * a],
      buf[2 * a + 1],
      (buf[2 * a] + buf[2 * b]) / 2,
      (buf[2 * a + 1] + buf[2 * b + 1]) / 2,
    );
  }
  target.closePath();
};

export const createForestRenderer = (
  canvas: HTMLCanvasElement,
  options: Partial<ForestOptions> = {},
  mark: MarkOptions = DEFAULT_MARK,
  onLayout?: (layout: ForestLayout) => void,
): ForestRenderer | null => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const markOpts = { ...mark };
  let blobNoise = createNoise2D(mulberry32(opts.seed * 17 + 1));
  const noise = createNoise2D(mulberry32(97));

  let trees: Tree[] = [];
  let buffer = new Float64Array(Math.max(POINTS, MARK_F.n) * 2);
  /** The f's outline for one frame, in viewBox units. */
  const fBuffer = new Float64Array(MARK_F.n * 2);
  /** The whole skyline for one frame: ground, grass and trees as one line. */
  let line = new Float64Array(0);
  let W = 0;
  let H = 0;
  let dprScale = 1;
  let lastDpr = 1;
  /** One design pixel in CSS px (1 at 1024 tall), floored for phones. */
  let u = 1;
  let groundX = new Float64Array(0);
  let lastTime = 0;
  /** When the intro began, on the renderer's clock. */
  let introStart = 0;
  let gustStart = -1;
  let gustDir: 1 | -1 = 1;
  let nextGust = 6;

  /** The resting ground line: hills highest in the middle, with smaller waves. */
  const groundRest = (x: number): number => {
    const c = (x - W / 2) / (W / 2);
    const hill = opts.hill * H * (0.5 + 0.5 * Math.cos(Math.PI * c));
    const wave = opts.waves * H * Math.sin(Math.PI * opts.waveCount * c + 0.7);
    return opts.horizon * H - hill - wave;
  };

  const plant = () => {
    const rng = mulberry32(opts.seed);
    blobNoise = createNoise2D(mulberry32(opts.seed * 17 + 1));
    const S = Math.min(H, 1.2 * W);
    const logoH = logoHeight(W, H, markOpts.logo);
    const maxH = opts.treeMax * logoH;
    const minH = opts.treeMin * maxH;
    const clearing = Math.max(
      opts.clearing * W,
      0.5 * logoWidth(logoH, markOpts.oShift) + 0.05 * S,
    );
    const list: Tree[] = [];
    const kinds: TreeKind[] = ['round', 'oval'];
    const place = (side: 1 | -1) => {
      let x = W / 2 + side * clearing;
      let prevW = 0;
      while (side > 0 ? x < W + 0.1 * S : x > -0.1 * S) {
        const spruce = rng() < opts.spruces;
        const kind: TreeKind = spruce ? 'spruce' : kinds[Math.floor(rng() * 2)];
        const h = minH + (maxH - minH) * rng();
        // Width for spacing: a cone's base, a crown's diameter.
        const w =
          h *
          (kind === 'spruce'
            ? 0.45 + 0.15 * rng()
            : kind === 'oval'
              ? 0.8 * (1 - opts.trunk)
              : 1.08 * (1 - opts.trunk));
        const meanW = (prevW + w) / 2 || w;
        x +=
          side * (prevW / 2 + opts.gap * meanW * (0.6 + 0.8 * rng()) + w / 2);
        const seed = rng() * 100;
        list.push({
          kind,
          x,
          h,
          w,
          seed,
          delay:
            0.3 +
            (opts.morphStagger * Math.abs(x - W / 2)) / (W / 2) +
            0.15 * rng(),
          shape: resampleOpen(
            treeShape(kind, w / h, seed, opts.trunk, blobNoise),
            POINTS,
          ),
          mound: resampleOpen(moundShape(w / h), POINTS),
        });
        // A bush now and then, in the gap after this tree.
        if (rng() < opts.bushes) {
          const bh = h * (0.18 + 0.14 * rng());
          const bw = bh * (1.6 + 0.8 * rng());
          const bx = x + side * (w / 2 + bw / 2 + 0.1 * meanW * rng());
          const bseed = rng() * 100;
          list.push({
            kind: 'bush',
            x: bx,
            h: bh,
            w: bw,
            seed: bseed,
            delay:
              0.3 +
              (opts.morphStagger * Math.abs(bx - W / 2)) / (W / 2) +
              0.2 * rng(),
            shape: resampleOpen(
              treeShape('bush', bw / bh, bseed, opts.trunk, blobNoise),
              POINTS,
            ),
            mound: resampleOpen(moundShape(bw / bh), POINTS),
          });
        }
        prevW = w;
      }
    };
    place(1);
    place(-1);
    // Left to right, the order the skyline walks them in.
    trees = list.sort((a, b) => a.x - b.x);
    line = new Float64Array((groundX.length + trees.length * POINTS + 4) * 2);
  };

  const layout = (): ForestLayout => {
    const logoH = logoHeight(W, H, markOpts.logo);
    const rootOffset =
      ((LOGO_VIEWBOX.w + markOpts.oShift) / 2 -
        (LOGO_ROOT.x - LOGO_VIEWBOX.x)) /
      LOGO_VIEWBOX.h;
    const x = W / 2 - rootOffset * logoH;
    return { width: W, height: H, root: { x, y: groundRest(x) + 0.02 * H } };
  };

  const resize = (w: number, h: number, dpr: number) => {
    W = w;
    H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    dprScale = dpr;
    lastDpr = dpr;
    u = Math.max(0.55, Math.min(h / 1024, w / 1440));
    // Fine enough to draw the grass ripple as a smooth wave.
    const step = Math.min(
      Math.max(2, 3 * u),
      Math.max(1, (opts.grassWavelength * u) / 6),
    );
    const count = Math.ceil(W / step) + 3;
    groundX = new Float64Array(count);
    for (let i = 0; i < count; i++) groundX[i] = -step + i * step;
    buffer = new Float64Array(Math.max(POINTS, MARK_F.n) * 2);
    plant();
    onLayout?.(layout());
  };

  const setOptions = (next: Partial<ForestOptions>) => {
    Object.assign(opts, next);
    if (W > 0 && H > 0) resize(W, H, lastDpr);
  };
  const setMark = (next: MarkOptions) => {
    Object.assign(markOpts, next);
    if (W > 0 && H > 0) {
      plant();
      onLayout?.(layout());
    }
  };

  /** Where the gust's centre is now, or null when there is none. */
  const gustCentre = (time: number): number | null => {
    if (gustStart < 0) return null;
    const p = (time - gustStart) / opts.gustSeconds;
    if (p >= 1) return null;
    const sigma = 0.22 * W;
    const span = W + 2 * sigma;
    return gustDir > 0 ? -sigma + span * p : W + sigma - span * p;
  };
  const gustAt = (x: number, time: number): number => {
    const c = gustCentre(time);
    if (c === null) return 0;
    return gustDir * bump((x - c) / (0.22 * W));
  };
  /** Ambient wind, slowly drifting, plus the gust: −1..1-ish. */
  const windAt = (x: number): number =>
    opts.wind *
    (0.45 * noise(lastTime * 0.12 + x * 0.0006, 11) + gustAt(x, lastTime));

  const draw = (time: number) => {
    if (W === 0 || H === 0) return;
    lastTime = time;
    if (gustStart >= 0 && time - gustStart >= opts.gustSeconds) gustStart = -1;
    if (gustStart < 0 && time >= nextGust) {
      gustStart = time;
      gustDir = gustDir === 1 ? -1 : 1;
      nextGust = time + opts.gustEvery * (0.8 + 0.4 * noise(time, 3));
    }

    ctx.setTransform(dprScale, 0, 0, dprScale, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK;

    const breath = 2.5 * u * Math.sin((time / opts.breathSeconds) * TAU);
    const amp = opts.wobble * u;
    const flow = time * 0.06;
    // The hills swell out of a flat line as the morph begins.
    const intro = time - introStart;
    const swell = ease(clamp01((intro - 0.2) / opts.morphSeconds));
    const groundAt = (x: number) =>
      opts.horizon * H + (groundRest(x) - opts.horizon * H) * swell + breath;

    // The skyline is one line, walked left to right: the ground with the
    // grass ripple riding on it, and at every tree the line climbs its
    // outline, goes over the crown and comes back down to the ground. The
    // ripple travels with the wind and grows where the wind blows harder.
    const lambda = opts.grassWavelength * u;
    const groundLine = (x: number) => {
      const wind = windAt(x);
      const phase =
        (x / lambda) * TAU - time * opts.grassSpeed * TAU * (0.6 + wind);
      const grass =
        opts.grassAmp *
        u *
        swell *
        (0.7 + 0.6 * Math.abs(wind)) *
        (0.5 + 0.5 * Math.sin(phase));
      return groundAt(x) - grass + amp * noise(x * 0.012 + flow, 77);
    };
    let n = 0;
    const emit = (x: number, y: number) => {
      line[2 * n] = x;
      line[2 * n + 1] = y;
      n++;
    };
    let gi = 0;
    for (const tree of trees) {
      // Morph: a flat stretch of the line bulges into a mound, and the
      // mound grows into the tree.
      const p = ease(clamp01((intro - tree.delay) / opts.morphSeconds));
      if (p <= 0) continue;
      const toMound = ease(clamp01(p / 0.35));
      const toTree = ease(clamp01((p - 0.35) / 0.65));
      const rest = groundAt(tree.x);
      const wind = windAt(tree.x);
      const sway = (tree.kind === 'bush' ? 0.02 : 0.05) * wind * tree.h;
      const { shape, mound, h, seed } = tree;
      for (let j = 0; j < POINTS; j++) {
        const mx = mound[2 * j];
        const my = mound[2 * j + 1] * toMound;
        const lx = mx + (shape[2 * j] - mx) * toTree;
        const ly = my + (shape[2 * j + 1] - my) * toTree;
        const up = Math.max(0, -ly);
        // Where the outline meets the ground it follows the ground line
        // exactly; a little higher up the tree is rigid and wobbles alone.
        const rigid = ease(clamp01(up / 0.15));
        let x = tree.x + lx * h + sway * up * up;
        const foot = groundLine(x);
        let y = foot + (rest - foot) * rigid + ly * h;
        x += rigid * amp * noise(x * 0.012 + flow, y * 0.012 + seed);
        y += rigid * amp * noise(x * 0.012 + flow + 30, y * 0.012 + seed + 30);
        buffer[2 * j] = x;
        buffer[2 * j + 1] = y;
      }
      const left = buffer[0];
      const right = buffer[2 * (POINTS - 1)];
      while (gi < groundX.length && groundX[gi] < left) {
        emit(groundX[gi], groundLine(groundX[gi]));
        gi++;
      }
      while (gi < groundX.length && groundX[gi] <= right) gi++;
      for (let j = 0; j < POINTS; j++) emit(buffer[2 * j], buffer[2 * j + 1]);
    }
    while (gi < groundX.length) {
      emit(groundX[gi], groundLine(groundX[gi]));
      gi++;
    }

    // Through the midpoints with curves, so the line never has a corner,
    // then down and around the bottom of the screen.
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    ctx.lineTo(line[0], line[1]);
    for (let k = 1; k < n - 1; k++) {
      ctx.quadraticCurveTo(
        line[2 * k],
        line[2 * k + 1],
        (line[2 * k] + line[2 * k + 2]) / 2,
        (line[2 * k + 1] + line[2 * k + 3]) / 2,
      );
    }
    ctx.lineTo(line[2 * (n - 1)], line[2 * (n - 1) + 1]);
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fill();

    drawMark(time, intro, groundAt);
  };

  /**
   * The mark, in the same ink: the f sprouts out of the ground on load (see
   * sprout.ts) and sways with the wind, the o rises after it and floats. Both outlines
   * breathe: they swell and shrink very slowly, and their edges are pushed
   * along the normals by noise travelling around the path, so the line
   * looks alive, like the rings of a tree.
   */
  const drawMark = (
    time: number,
    intro: number,
    groundAt: (x: number) => number,
  ) => {
    const logoH = logoHeight(W, H, markOpts.logo);
    const sc = logoH / LOGO_VIEWBOX.h;
    const { x: rootX } = layout().root;
    const rootY = groundAt(rootX) + 0.02 * H;
    const progress = (intro - SPROUT_DELAY) / markOpts.sproutSeconds;
    if (progress <= 0) return;
    const pose = sproutPose(F_SPINE, progress, markOpts.coil);
    const settled = ease(clamp01((progress - 0.6) / 0.4));
    const rise = ease(
      clamp01(
        ((progress - O_RISE_AT) * markOpts.sproutSeconds) / O_RISE_SECONDS,
      ),
    );
    const wind = windAt(rootX);
    const breath = Math.sin((time / markOpts.markBreath) * TAU);
    // Wobble in viewBox units, and its travel around the outline.
    const amp = (markOpts.markWobble * u) / sc;
    const wavelength = 120;
    const spin = time * 0.1;
    const wobbleOf = (o: Outline, offset: number) => {
      const r1 = o.length / (wavelength * TAU);
      const r2 = r1 / 2.5;
      return (j: number) => {
        const theta = (o.s[j] / o.length) * TAU - spin / r1;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        return (
          amp *
          (0.6 * noise(r1 * cos + offset, r1 * sin + offset) +
            0.5 * noise(r2 * cos + offset + 40, r2 * sin + offset + 40))
        );
      };
    };

    // The f grows out of the ground like a fern: up along its spine with
    // a coiled tip, then the coil unfurls and the leaves spread. Then it
    // leans with the wind about the foot of its stem and swells a touch
    // with the breath.
    sproutOutline(F_SPINE, F_BOUND, pose, wobbleOf(MARK_F, 7), fBuffer);
    const angle =
      ((1.1 * noise(time * 0.17, 5) + 2.2 * wind) * settled * Math.PI) / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const fScale = sc * (1 + 0.012 * breath * settled);
    const footX = F_SPINE.x[0];
    const footY = F_SPINE.y[0];
    const pivotX = rootX + (footX - LOGO_ROOT.x) * sc;
    const pivotY = rootY + (footY - LOGO_ROOT.y) * sc;
    for (let j = 0; j < MARK_F.n; j++) {
      const lx = (fBuffer[2 * j] - footX) * fScale;
      const ly = (fBuffer[2 * j + 1] - footY) * fScale;
      buffer[2 * j] = pivotX + lx * cosA - ly * sinA;
      buffer[2 * j + 1] = pivotY + lx * sinA + ly * cosA;
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    traceSmooth(ctx, buffer, MARK_F.n);
    ctx.fill();

    // The o: rises from behind the horizon to its place beside the f,
    // smaller than in Figma, bobbing and breathing on its own.
    if (rise <= 0) return;
    const bob = 3 * Math.sin((time / 9) * TAU);
    const lift = markOpts.oLift * rise - 150 * (1 - rise) + bob;
    const shift = markOpts.oShift * rise;
    const oScale =
      markOpts.oScale *
      (1 + 0.02 * Math.sin((time / markOpts.markBreath) * TAU + 1.3));
    const oWobble = wobbleOf(MARK_O, 23);
    ctx.globalAlpha = 0.1 + 0.9 * rise;
    for (let j = 0; j < MARK_O.n; j++) {
      const d = oWobble(j);
      const x = MARK_O.x[j] + MARK_O.nx[j] * d;
      const y = MARK_O.y[j] + MARK_O.ny[j] * d;
      const vx = oCentre.x + (x - oCentre.x) * oScale + shift;
      const vy = oCentre.y + (y - oCentre.y) * oScale - lift;
      buffer[2 * j] = rootX + (vx - LOGO_ROOT.x) * sc;
      buffer[2 * j + 1] = rootY + (vy - LOGO_ROOT.y) * sc;
    }
    ctx.beginPath();
    traceSmooth(ctx, buffer, MARK_O.n);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const gust = (direction: 1 | -1) => {
    if (gustStart >= 0 && lastTime - gustStart < opts.gustSeconds * 0.5) return;
    gustStart = lastTime;
    gustDir = direction;
    nextGust = lastTime + opts.gustEvery;
  };

  const restart = () => {
    introStart = lastTime;
  };

  return { resize, draw, setOptions, setMark, restart, gust, windAt, layout };
};
