import { createNoise2D } from 'simplex-noise';
import { LOGO_ROOT, LOGO_VIEWBOX } from './logo-paths';

/**
 * The forest: the lower part of the screen is ink, the sky above is paper.
 * The ground is a wavy line of hills, highest in the middle under the mark,
 * with a ripple of grass running along it that moves with the wind. On the
 * hills stand cartoon trees, each one on its own: round crowns on trunks,
 * lollipops, soft spruces, bushes. Every tree is one smooth closed polygon
 * with the same number of points as a plain mound, so on load the forest
 * morphs out of a flat line: the hills swell and each mound turns into its
 * tree, from the middle outward. Edges wobble a touch like a pencil line,
 * trees lean with a wind that drifts and gusts, the ground breathes.
 */

const TAU = Math.PI * 2;

export type TreeKind = 'round' | 'lollipop' | 'spruce' | 'bush';

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
  horizon: 0.73,
  hill: 0.045,
  waves: 0.005,
  waveCount: 5.9,
  treeMax: 0.17,
  treeMin: 0.28,
  gap: 1.35,
  clearing: 0.13,
  spruces: 0.5,
  bushes: 0,
  trunk: 0.29,
  grassAmp: 4.3,
  grassWavelength: 10,
  grassSpeed: 0,
  wind: 3,
  gustEvery: 3,
  gustSeconds: 7,
  breathSeconds: 12,
  wobble: 3.3,
  morphSeconds: 0.5,
  morphStagger: 0.3,
  seed: 3,
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
  /** The final outline, local units (1 tall, base at the origin, y up is negative). */
  shape: number[];
  /** The plain mound it morphs from, same point count. */
  mound: number[];
};

/**
 * A tree's outline in local units, one smooth closed polygon that starts at
 * the base's left end, goes up and over to the right, and closes along the
 * ground. Crowns are blobs (a circle with soft lobes), spruces are blunt
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
        lobes * blobNoise(1.6 * Math.cos(a) + seed, 1.6 * Math.sin(a) + seed);
      push(cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a));
    }
  };
  const deg = Math.PI / 180;
  switch (kind) {
    case 'round': {
      const r = (1 - trunk) / 2 + 0.08;
      const tw = 0.05 + 0.02 * w;
      const cy = -(1 - r);
      push(-tw, 0);
      push(-tw, cy + r * 0.55);
      blob(0, cy, (w / 2) * 1.05, r, 125 * deg, 415 * deg, 0.09);
      push(tw, cy + r * 0.55);
      push(tw, 0);
      return pts;
    }
    case 'lollipop': {
      const r = 0.3;
      const tw = 0.035;
      const cy = -(1 - r);
      push(-tw, 0);
      push(-tw, cy + r * 0.7);
      blob(0, cy, w / 2, r, 120 * deg, 420 * deg, 0.05);
      push(tw, cy + r * 0.7);
      push(tw, 0);
      return pts;
    }
    case 'spruce': {
      const tw = 0.04;
      const n = 28;
      push(-tw, 0);
      push(-tw, -0.07);
      // Left side up: a blunt cone whose sides bulge softly, like boughs.
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const bulge =
          1 + 0.12 * (0.5 + 0.5 * Math.sin(5 * Math.PI * t - Math.PI / 2));
        const x = (w / 2) * (1 - t) ** 0.8 * bulge;
        push(-x, -0.07 - 0.93 * t);
      }
      for (let i = n; i >= 0; i--) {
        const t = i / n;
        const bulge =
          1 + 0.12 * (0.5 + 0.5 * Math.sin(5 * Math.PI * t - Math.PI / 2));
        const x = (w / 2) * (1 - t) ** 0.8 * bulge;
        push(x, -0.07 - 0.93 * t);
      }
      push(tw, -0.07);
      push(tw, 0);
      return pts;
    }
    default: {
      push(-w / 2, 0);
      blob(0, -0.45, w / 2, 0.55, 150 * deg, 390 * deg, 0.12);
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
};

export const DEFAULT_MARK: MarkOptions = { logo: 0.35, oLift: 41, oShift: 4 };

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
  let buffer = new Float64Array(POINTS * 2);
  let W = 0;
  let H = 0;
  let dprScale = 1;
  /** One design pixel in CSS px (1 at 1024 tall), floored for phones. */
  let u = 1;
  let groundX = new Float64Array(0);
  let lastTime = 0;
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
    const kinds: TreeKind[] = ['round', 'lollipop'];
    const place = (side: 1 | -1) => {
      let x = W / 2 + side * clearing;
      let prevW = 0;
      while (side > 0 ? x < W + 0.1 * S : x > -0.1 * S) {
        const spruce = rng() < opts.spruces;
        const kind: TreeKind = spruce ? 'spruce' : kinds[Math.floor(rng() * 2)];
        const h = minH + (maxH - minH) * rng();
        const w =
          h * (kind === 'spruce' ? 0.45 + 0.15 * rng() : 0.7 + 0.3 * rng());
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
          shape: resample(
            treeShape(kind, w / h, seed, opts.trunk, blobNoise),
            POINTS,
          ),
          mound: resample(moundShape(w / h), POINTS),
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
            shape: resample(
              treeShape('bush', bw / bh, bseed, opts.trunk, blobNoise),
              POINTS,
            ),
            mound: resample(moundShape(bw / bh), POINTS),
          });
        }
        prevW = w;
      }
    };
    place(1);
    place(-1);
    trees = list;
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
    u = Math.max(0.55, Math.min(h / 1024, w / 1440));
    const step = Math.max(2, 3 * u);
    const count = Math.ceil(W / step) + 3;
    groundX = new Float64Array(count);
    for (let i = 0; i < count; i++) groundX[i] = -step + i * step;
    buffer = new Float64Array(POINTS * 2);
    plant();
    onLayout?.(layout());
  };

  const setOptions = (next: Partial<ForestOptions>) => {
    Object.assign(opts, next);
    if (W > 0 && H > 0) {
      plant();
      onLayout?.(layout());
    }
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
    const swell = ease(clamp01((time - 0.2) / opts.morphSeconds));
    const groundAt = (x: number) =>
      opts.horizon * H + (groundRest(x) - opts.horizon * H) * swell + breath;

    // The ground: hills with the grass ripple riding on them. The ripple
    // travels with the wind and grows where the wind blows harder.
    const lambda = opts.grassWavelength * u;
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (let i = 0; i < groundX.length; i++) {
      const x = groundX[i];
      const wind = windAt(x);
      const phase =
        (x / lambda) * TAU - time * opts.grassSpeed * TAU * (0.6 + wind);
      // A smooth wave (no cusps): blades of grass as rolling bumps.
      const grass =
        opts.grassAmp *
        u *
        swell *
        (0.7 + 0.6 * Math.abs(wind)) *
        (0.5 + 0.5 * Math.sin(phase));
      const y = groundAt(x) - grass + amp * noise(x * 0.02 + flow, 77);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fill();

    // The trees: each morphs from its mound, leans in the wind, wobbles a touch.
    for (const tree of trees) {
      const p = ease(clamp01((time - tree.delay) / opts.morphSeconds));
      if (p <= 0) continue;
      const base = groundAt(tree.x) + 1.5 * u;
      const wind = windAt(tree.x);
      const sway = (tree.kind === 'bush' ? 0.02 : 0.05) * wind * tree.h;
      const { shape, mound, h, seed } = tree;
      for (let j = 0; j < POINTS; j++) {
        const lx = mound[2 * j] + (shape[2 * j] - mound[2 * j]) * p;
        const ly = mound[2 * j + 1] + (shape[2 * j + 1] - mound[2 * j + 1]) * p;
        const up = Math.max(0, -ly);
        let x = tree.x + lx * h + sway * up * up;
        let y = base + ly * h;
        x += amp * noise(x * 0.03 + flow, y * 0.03 + seed);
        y += amp * noise(x * 0.03 + flow + 30, y * 0.03 + seed + 30);
        buffer[2 * j] = x;
        buffer[2 * j + 1] = y;
      }
      ctx.beginPath();
      ctx.moveTo(buffer[0], buffer[1]);
      for (let j = 1; j < POINTS; j++)
        ctx.lineTo(buffer[2 * j], buffer[2 * j + 1]);
      ctx.closePath();
      ctx.fill();
    }
  };

  const gust = (direction: 1 | -1) => {
    if (gustStart >= 0 && lastTime - gustStart < opts.gustSeconds * 0.5) return;
    gustStart = lastTime;
    gustDir = direction;
    nextGust = lastTime + opts.gustEvery;
  };

  return { resize, draw, setOptions, setMark, gust, windAt, layout };
};
