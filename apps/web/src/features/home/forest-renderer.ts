import { createNoise2D } from 'simplex-noise';
import { LOGO_ROOT, LOGO_VIEWBOX, O_SHIFT } from './logo-paths';

/**
 * The forest: the lower third of the screen is ink, the sky above is paper,
 * and the edge between them is one continuous line, as if the whole horizon
 * were drawn without lifting the pencil. Trees, bushes and tufts of grass
 * are smooth bumps on that line (round crowns, soft spires, low mounds),
 * joined with a soft maximum so every meeting of two shapes is rounded. The
 * line wobbles a touch like a hand-drawn stroke, trees lean with a wind that
 * drifts and gusts, grass ripples in waves, the ground breathes, and on load
 * the forest grows out of the ground from the clearing outward. The clearing
 * in the middle leaves room for the mark.
 */

const TAU = Math.PI * 2;

export type PlantKind = 'crown' | 'spire' | 'bush' | 'tuft';

export type Plant = {
  kind: PlantKind;
  /** Position across the screen, 0..1 of the width (may spill past the edges). */
  x: number;
  /** Height as a fraction of the forest scale (the screen height, less on narrow phones). */
  h: number;
  /** Half-width relative to the height. */
  w: number;
  /** Shape and sway variation. */
  seed: number;
  /** Seconds before this plant starts growing on load. */
  delay: number;
};

export type ForestOptions = {
  /** Where the horizon sits, as a fraction of the screen height from the top. */
  horizon: number;
  /** Half-width of the clearing in the middle, as a fraction of the width. */
  clearing: number;
  /** Hand-drawn wobble amplitude in design px (1 at 1024 px tall). */
  wobble: number;
  /** Radius of the rounded joins between shapes, in design px. */
  rounding: number;
  /** Seconds between two gusts of wind. */
  gustEvery: number;
  /** How long a gust takes to cross the screen. */
  gustSeconds: number;
  /** Seconds of one breath of the whole forest. */
  breathSeconds: number;
  /** Seed for the forest, so it is the same forest on every visit. */
  seed: number;
};

export const DEFAULT_OPTIONS: ForestOptions = {
  horizon: 2 / 3,
  clearing: 0.1,
  wobble: 1.4,
  rounding: 9,
  gustEvery: 13,
  gustSeconds: 4.5,
  breathSeconds: 7,
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

const smoothstep = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Eases out past 1 and settles back, like a shoot springing up. */
const easeOutBack = (p: number, c1 = 1.2) => {
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};
/** Raised-cosine bump, 1 at the centre and 0 beyond ±1. */
export const bump = (u: number): number =>
  u <= -1 || u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * u);

/**
 * A plant's outline as a height profile over u = −1..1 (its half-width):
 * 1 at the top, 0 at the edges, smooth everywhere. A crown is a round
 * mound, a spire a soft peak with concave flanks, a bush a low mound, a tuft
 * a narrow blip of grass.
 */
export const profile = (kind: PlantKind, u: number): number => {
  if (u <= -1 || u >= 1) return 0;
  switch (kind) {
    case 'crown':
      return (1 - u * u) ** 0.75;
    case 'spire':
      return bump(u) ** 2.4;
    case 'bush':
      return bump(u) ** 0.9;
    default:
      return bump(u) ** 1.6;
  }
};

/**
 * Plants the forest: trees along the whole width with uneven gaps, shorter
 * toward the clearing and none inside it, bushes here and there, and tufts
 * of grass everywhere, a little taller in the meadow.
 */
export const growForest = (
  seed: number,
  clearing = DEFAULT_OPTIONS.clearing,
): Plant[] => {
  const rng = mulberry32(seed);
  const plants: Plant[] = [];
  const kinds: PlantKind[] = [
    'spire',
    'spire',
    'spire',
    'crown',
    'crown',
    'crown',
    'bush',
  ];
  let x = -0.06;
  while (x < 1.06) {
    const d = Math.abs(x - 0.5);
    // How tall things may grow here: only grass and bushes in the clearing,
    // then taller and taller away from it.
    const room = smoothstep(clearing, clearing + 0.16, d);
    const kind = kinds[Math.floor(rng() * kinds.length)];
    let h: number;
    let w: number;
    switch (kind) {
      case 'spire':
        h = 0.12 + 0.16 * rng();
        w = 0.26 + 0.14 * rng();
        break;
      case 'crown':
        h = 0.08 + 0.09 * rng();
        w = 0.45 + 0.25 * rng();
        break;
      default:
        h = 0.025 + 0.025 * rng();
        w = 1 + 0.6 * rng();
    }
    if (kind !== 'bush') h *= 0.3 + 0.7 * room;
    if (
      (kind === 'bush' && d > clearing * 0.6) ||
      (kind !== 'bush' && room > 0.05)
    ) {
      plants.push({
        kind,
        x,
        h,
        w,
        seed: rng() * 1000,
        delay: 0.5 + d * 3.2 + rng() * 0.5,
      });
    }
    x += kind === 'bush' ? 0.015 + 0.02 * rng() : 0.022 + 0.03 * rng();
  }
  // Tufts of grass: a small one every so often, taller in the meadow.
  let gx = -0.02;
  while (gx < 1.02) {
    const d = Math.abs(gx - 0.5);
    const meadow = 1 - smoothstep(clearing * 0.8, clearing + 0.12, d);
    plants.push({
      kind: 'tuft',
      x: gx,
      h: (0.004 + 0.006 * rng()) * (1 + 0.5 * meadow),
      w: 1 + 0.8 * rng(),
      seed: rng() * 1000,
      delay: 0.2 + d * 2.6 + rng() * 0.6,
    });
    gx += 0.012 + 0.014 * rng();
  }
  return plants;
};

/** The mark's height for a screen: a third of the height, less on narrow phones. */
export const logoHeight = (width: number, height: number): number =>
  Math.min(0.34 * height, 0.55 * width);
/** The mark's width for that height. */
export const logoWidth = (height: number): number =>
  height * ((LOGO_VIEWBOX.w + O_SHIFT) / LOGO_VIEWBOX.h);
/** The sprout's root sits left of the mark's centre by this much of its height. */
const ROOT_OFFSET =
  ((LOGO_VIEWBOX.w + O_SHIFT) / 2 - (LOGO_ROOT.x - LOGO_VIEWBOX.x)) /
  LOGO_VIEWBOX.h;

export type ForestLayout = {
  width: number;
  height: number;
  /** The horizon's resting height in CSS px. */
  horizonY: number;
  /** Where the sprout's stem meets the ground, in CSS px. */
  root: { x: number; y: number };
};

export type ForestRenderer = {
  resize: (width: number, height: number, dpr: number) => void;
  draw: (time: number) => void;
  /** Sends a gust across the forest from the left (+1) or the right (−1). */
  gust: (direction: 1 | -1) => void;
  /** Wind strength at a screen x right now, about −1..1 (positive blows right). */
  windAt: (x: number) => number;
  /** How far the forest has grown in, 0..1 (1 once the intro is over). */
  grown: () => number;
  layout: () => ForestLayout;
};

export const INK = '#2d493a';
export const PAPER = '#f7f6f1';

export const createForestRenderer = (
  canvas: HTMLCanvasElement,
  options: Partial<ForestOptions> = {},
  onLayout?: (layout: ForestLayout) => void,
): ForestRenderer | null => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const noise = createNoise2D(mulberry32(opts.seed * 17 + 2));
  let plants: Plant[] = [];

  let W = 0;
  let H = 0;
  let dprScale = 1;
  /** One design pixel in CSS px (1 at 1024 tall), floored for phones. */
  let u = 1;
  let horizonY = 0;
  /** What plant sizes scale with: the height, capped on narrow phones. */
  let S = 0;
  /** The skyline, sampled every `step` px: soft-max accumulators and heights. */
  let step = 3;
  let acc = new Float64Array(0);
  let lastTime = 0;
  /** Current gust: when it started and which way it blows; -1 = none. */
  let gustStart = -1;
  let gustDir: 1 | -1 = 1;
  let nextGust = 6;
  let grownLevel = 0;

  const resize = (w: number, h: number, dpr: number) => {
    W = w;
    H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    dprScale = dpr;
    u = Math.max(0.55, Math.min(h / 1024, w / 1440));
    horizonY = h * opts.horizon;
    S = Math.min(h, 1.2 * w);
    // The clearing is at least as wide as the mark, with a little meadow around it.
    const clearing = Math.max(
      opts.clearing,
      (0.5 * logoWidth(logoHeight(w, h))) / w + 0.04,
    );
    plants = growForest(opts.seed, clearing);
    step = Math.max(2, 3 * u);
    acc = new Float64Array(Math.ceil(W / step) + 3);
    onLayout?.(layout());
  };

  const layout = (): ForestLayout => ({
    width: W,
    height: H,
    horizonY,
    // The whole mark is centred; the sprout grows left of the middle, the sun hangs right.
    root: {
      x: W / 2 - ROOT_OFFSET * logoHeight(W, H),
      y: horizonY + 0.02 * H,
    },
  });

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
    0.45 * noise(lastTime * 0.12 + x * 0.0006, 11) + gustAt(x, lastTime);

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

    const breath = Math.sin((time / opts.breathSeconds) * TAU);
    const k = 1 / (opts.rounding * u);
    // Soft maximum of every plant's height over the ground: each plant adds
    // exp(k·h) over its own span, the ground contributes 1, and the line is
    // log(sum)/k, so shapes meet in rounded joins instead of corners.
    acc.fill(1);
    let grownSum = 0;
    for (const plant of plants) {
      const grow = clamp01((time - plant.delay) / 1.5);
      grownSum += grow;
      const growth = easeOutBack(grow);
      if (growth <= 0) continue;
      const h = plant.h * S * growth * (1 + 0.006 * breath);
      const half = plant.w * plant.h * S;
      const cx = plant.x * W;
      const grass = plant.kind === 'tuft';
      // Wind: trees lean a little, grass bends more and in travelling waves.
      const wind = grass
        ? 0.5 * noise(time * 0.5 - cx * 0.004, 12 + plant.seed * 0.01) +
          0.7 * gustAt(cx, time)
        : 0.06 * noise(time * 0.13 + plant.seed * 0.37, 11) +
          0.11 * gustAt(cx, time);
      // The tip moves by `sway`, the base stays: the profile is sheared.
      const sway = wind * h;
      const from = Math.max(0, Math.floor((cx - half - Math.abs(sway)) / step));
      const to = Math.min(
        acc.length - 1,
        Math.ceil((cx + half + Math.abs(sway)) / step),
      );
      for (let i = from; i <= to; i++) {
        const x = i * step;
        const p0 = profile(plant.kind, (x - cx) / half);
        const p = profile(plant.kind, (x - cx - sway * p0 * p0) / half);
        if (p > 0) acc[i] += Math.exp(k * h * p);
      }
    }
    grownLevel = plants.length ? grownSum / plants.length : 1;

    // One stroke from the left edge to the right: the ground's gentle hills,
    // the plants on top, and a hand-drawn wobble along the whole line.
    const amp = opts.wobble * u;
    const flow = time * 0.06;
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (let i = 0; i < acc.length; i++) {
      const x = i * step;
      const hill = 0.012 * H * noise((x / W) * 2.2 + 50, 50);
      const line = Math.log(acc[i]) / k;
      const y =
        horizonY +
        hill +
        2.5 * u * breath -
        line +
        amp * noise(x * 0.02 + flow, 77) +
        0.3 * u * noise(x * 0.07, 9);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fill();
  };

  const gust = (direction: 1 | -1) => {
    if (gustStart >= 0 && lastTime - gustStart < opts.gustSeconds * 0.5) return;
    gustStart = lastTime;
    gustDir = direction;
    nextGust = lastTime + opts.gustEvery;
  };

  return { resize, draw, gust, windAt, grown: () => grownLevel, layout };
};
