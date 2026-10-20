import { createNoise2D } from 'simplex-noise';

/**
 * The forest: the lower third of the screen is ink, the sky above is paper,
 * and the edge between them is a hand-drawn silhouette of trees, bushes and
 * grass. Every plant is a small polygon drawn in ink (the union makes the
 * skyline), sampled finely and displaced by slow noise so the edges look
 * drawn by hand and keep moving a touch. Trees lean with a wind that drifts
 * and gusts, grass bends in waves, the ground rises and falls with a slow
 * breath, and on load the forest grows out of the ground, from the sprout in
 * the middle outward. The clearing in the middle leaves room for the mark.
 */

const TAU = Math.PI * 2;

export type PlantKind = 'spruce' | 'pine' | 'oak' | 'bush' | 'grass';

export type Plant = {
  kind: PlantKind;
  /** Position across the screen, 0..1 of the width (may spill past the edges). */
  x: number;
  /** Height as a fraction of the screen height. */
  h: number;
  /** Width relative to the height. */
  w: number;
  /** Shape variation. */
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
  wobble: 1.3,
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
 * Plants the forest: trees along the whole width with uneven gaps, shorter
 * toward the clearing and none inside it, bushes here and there, and grass
 * everywhere, a little taller in the meadow. Grass comes last in the list so
 * it is drawn in front.
 */
export const growForest = (
  seed: number,
  clearing = DEFAULT_OPTIONS.clearing,
): Plant[] => {
  const rng = mulberry32(seed);
  const plants: Plant[] = [];
  const kinds: PlantKind[] = [
    'spruce',
    'spruce',
    'spruce',
    'pine',
    'pine',
    'oak',
    'oak',
    'bush',
  ];
  let x = -0.04;
  while (x < 1.04) {
    const d = Math.abs(x - 0.5);
    // How tall things may grow here: nothing but grass and bushes in the
    // clearing, then taller and taller away from it.
    const room = smoothstep(clearing, clearing + 0.14, d);
    const kind = kinds[Math.floor(rng() * kinds.length)];
    if (room > 0.05 || kind === 'bush') {
      let h: number;
      let w: number;
      switch (kind) {
        case 'spruce':
          h = 0.13 + 0.15 * rng();
          w = 0.36 + 0.14 * rng();
          break;
        case 'pine':
          h = 0.15 + 0.11 * rng();
          w = 0.55 + 0.2 * rng();
          break;
        case 'oak':
          h = 0.1 + 0.09 * rng();
          w = 0.9 + 0.3 * rng();
          break;
        default:
          h = 0.03 + 0.035 * rng();
          w = 1.6 + 0.8 * rng();
      }
      if (kind !== 'bush') h *= 0.35 + 0.65 * room;
      if (kind !== 'bush' || d > clearing * 0.5) {
        plants.push({
          kind,
          x,
          h,
          w,
          seed: rng() * 1000,
          delay: 0.5 + d * 3.2 + rng() * 0.5,
        });
      }
    }
    x += kind === 'bush' ? 0.012 + 0.02 * rng() : 0.016 + 0.03 * rng();
  }
  // A few extra bushes right at the edge of the clearing, like a hedge.
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const bx = 0.5 + side * (clearing * (0.55 + 0.5 * rng()));
    plants.push({
      kind: 'bush',
      x: bx,
      h: 0.025 + 0.025 * rng(),
      w: 1.6 + 0.9 * rng(),
      seed: rng() * 1000,
      delay: 0.4 + Math.abs(bx - 0.5) * 3 + rng() * 0.4,
    });
  }
  // Grass: a blade every few pixels, taller in the meadow.
  let gx = -0.01;
  while (gx < 1.01) {
    const d = Math.abs(gx - 0.5);
    const meadow = 1 - smoothstep(clearing * 0.8, clearing + 0.1, d);
    plants.push({
      kind: 'grass',
      x: gx,
      h: (0.006 + 0.022 * rng()) * (1 + 0.5 * meadow),
      w: 0.08 + 0.05 * rng(),
      seed: rng() * 1000,
      delay: 0.2 + d * 2.6 + rng() * 0.6,
    });
    gx += 0.004 + 0.004 * rng();
  }
  return plants;
};

/**
 * A plant's outline(s) in local units: the base is at (0, 0), y runs up as
 * negative numbers, the plant is 1 tall and `w` wide. Closed polygons as
 * flat [x0, y0, x1, y1, …] arrays.
 */
export const plantShape = (
  plant: Plant,
  shapeNoise: (x: number, y: number) => number,
): number[][] => {
  const { kind, w, seed } = plant;
  const rng = mulberry32(Math.floor(seed * 7919));
  const lobed = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    count: number,
    amount: number,
  ): number[] => {
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const r =
        1 +
        amount * shapeNoise(2.2 * Math.cos(a) + seed, 2.2 * Math.sin(a) + seed);
      out.push(cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a));
    }
    return out;
  };
  switch (kind) {
    case 'spruce': {
      const tiers = 4 + Math.floor(rng() * 3);
      const lean = (rng() - 0.5) * 0.08;
      // Each tier: a drooping branch tip out to the side, then a notch back
      // toward the trunk where the next tier begins.
      const tips: [number, number][] = [];
      const notches: [number, number][] = [];
      for (let k = 1; k <= tiers; k++) {
        const y = -1 + (k / tiers) * 0.88;
        const half = (w / 2) * (k / tiers) ** 0.85 * (0.9 + 0.2 * rng());
        const droop = 0.02 + 0.02 * rng();
        tips.push([half + lean * y, y + droop]);
        notches.push([half * 0.5 + lean * y, y - 0.01]);
      }
      const trunk = 0.025;
      const out: number[] = [0, -1];
      for (let k = 0; k < tiers; k++) out.push(...tips[k], ...notches[k]);
      out.push(trunk, -0.1, trunk, 0, -trunk, 0, -trunk, -0.1);
      for (let k = tiers - 1; k >= 0; k--) {
        out.push(-notches[k][0], notches[k][1], -tips[k][0], tips[k][1]);
      }
      return [out];
    }
    case 'pine': {
      const t = 0.02 + 0.01 * rng();
      const lean = (rng() - 0.5) * 0.1;
      const crownY = -0.74 - 0.06 * rng();
      return [
        [t, 0, t * 0.8 + lean, -0.72, -t * 0.8 + lean, -0.72, -t, 0],
        lobed(
          lean + (rng() - 0.5) * 0.08,
          crownY,
          w / 2,
          0.16 + 0.05 * rng(),
          22,
          0.22,
        ),
        lobed(lean + (rng() - 0.5) * 0.2, crownY + 0.1, w / 3, 0.12, 14, 0.25),
      ];
    }
    case 'oak': {
      const t = 0.035 + 0.015 * rng();
      return [
        [t, 0, t * 0.7, -0.4, -t * 0.7, -0.4, -t, 0],
        lobed(0, -0.6, w / 2, 0.4, 28, 0.14),
      ];
    }
    case 'bush':
      return [lobed(0, -0.42, w / 2, 0.5, 18, 0.18)];
    default: {
      // A blade of grass: tapers to a point, bends with the wind (shear).
      const bw = w;
      const curve = (rng() - 0.5) * 0.3;
      return [
        [
          -bw,
          0,
          -bw * 0.45 + curve * 0.5,
          -0.55,
          curve,
          -1,
          bw * 0.45 + curve * 0.5,
          -0.55,
          bw,
          0,
        ],
      ];
    }
  }
};

/** Resamples a closed polygon so no edge is longer than `step`. */
export const densify = (poly: number[], step: number): number[] => {
  const out: number[] = [];
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const x0 = poly[2 * i];
    const y0 = poly[2 * i + 1];
    const x1 = poly[(2 * i + 2) % poly.length];
    const y1 = poly[(2 * i + 3) % poly.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
  }
  return out;
};

/** The mark's height for a screen: a third of the height, less on narrow phones. */
export const logoHeight = (width: number, height: number): number =>
  Math.min(0.34 * height, 0.55 * width);
/** The mark's width for that height (its viewBox is 348 × 374). */
export const logoWidth = (height: number): number => height * (348 / 374);
/** The sprout's root sits left of the mark's centre by this much of its height. */
const ROOT_OFFSET = 138 / 374;

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
  const shapeNoise = createNoise2D(mulberry32(opts.seed * 17 + 1));
  const noise = createNoise2D(mulberry32(opts.seed * 17 + 2));
  let plants: Plant[] = [];

  type Drawn = {
    plant: Plant;
    /** Densified local polygons. */
    polys: number[][];
    /** Scratch buffers, one per polygon, so a frame allocates nothing. */
    buffers: Float64Array[];
  };
  let drawn: Drawn[] = [];
  let groundX: Float64Array = new Float64Array(0);
  let groundHill: Float64Array = new Float64Array(0);
  let W = 0;
  let H = 0;
  let dprScale = 1;
  /** One design pixel in CSS px (1 at 1024 tall), floored for phones. */
  let u = 1;
  let horizonY = 0;
  let lastTime = 0;
  /** Current gust: when it started and which way it blows; -1 = none. */
  let gustStart = -1;
  let gustDir: 1 | -1 = 1;
  let nextGust = 6;
  let grownLevel = 0;

  const groundAt = (x: number, time: number): number => {
    // Gentle hills that breathe: the whole ground rises and falls slowly.
    const breath = Math.sin((time / opts.breathSeconds) * TAU);
    const hill = 0.012 * H * noise((x / W) * 2.2 + 50, 50);
    return horizonY + hill + 2.5 * u * breath;
  };

  const resize = (w: number, h: number, dpr: number) => {
    W = w;
    H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    dprScale = dpr;
    u = Math.max(0.55, Math.min(h / 1024, w / 1440));
    horizonY = h * opts.horizon;
    // The clearing is at least as wide as the mark, with a little meadow around it.
    const clearing = Math.max(
      opts.clearing,
      (0.5 * logoWidth(logoHeight(w, h))) / w + 0.04,
    );
    plants = growForest(opts.seed, clearing);
    const step = Math.max(2.5, 4 * u);
    drawn = plants.map((plant) => {
      const px = plant.h * H;
      const polys = plantShape(plant, shapeNoise).map((poly) =>
        densify(poly, step / px),
      );
      return {
        plant,
        polys,
        buffers: polys.map((poly) => new Float64Array(poly.length)),
      };
    });
    const count = Math.ceil(W / 6) + 2;
    groundX = new Float64Array(count);
    groundHill = new Float64Array(count);
    for (let i = 0; i < count; i++) groundX[i] = -6 + i * 6;
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

    const amp = opts.wobble * u;
    const flow = time * 0.06;
    const breath = Math.sin((time / opts.breathSeconds) * TAU);

    // The ground: a wavy band from the horizon down.
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (let i = 0; i < groundX.length; i++) {
      const x = groundX[i];
      const y = groundAt(x, time) + amp * noise(x * 0.02 + flow, 77);
      groundHill[i] = y;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fill();

    // The plants, each grown, leaning in the wind and wobbling by hand.
    let grownSum = 0;
    for (const { plant, polys, buffers } of drawn) {
      const px = plant.h * H * (1 + 0.006 * breath);
      const bx = plant.x * W;
      const growth = easeOutBack(clamp01((time - plant.delay) / 1.5));
      grownSum += clamp01((time - plant.delay) / 1.5);
      if (growth <= 0) continue;
      const base = groundAt(bx, time) + 1.5 * u;
      const grass = plant.kind === 'grass';
      // Wind: trees lean a little, grass bends a lot and in travelling waves.
      const wind = grass
        ? 0.3 * noise(time * 0.5 - bx * 0.004, 12 + plant.seed * 0.01) +
          0.45 * gustAt(bx, time)
        : 0.025 * noise(time * 0.13 + plant.seed * 0.37, 11) +
          0.05 * gustAt(bx, time);
      const sway = wind * px;
      for (let p = 0; p < polys.length; p++) {
        const poly = polys[p];
        const buf = buffers[p];
        const n = poly.length / 2;
        for (let j = 0; j < n; j++) {
          const lx = poly[2 * j];
          const ly = poly[2 * j + 1];
          // Shear grows with height, so the tip moves and the base stays.
          const up = Math.max(0, -ly);
          const shear = sway * up * (grass ? up : Math.sqrt(up));
          let x = bx + lx * px + shear;
          let y = base + ly * px * growth;
          x += amp * noise(x * 0.025 + flow, y * 0.025 + plant.seed);
          y += amp * noise(x * 0.025 + flow + 30, y * 0.025 + plant.seed + 30);
          buf[2 * j] = x;
          buf[2 * j + 1] = y;
        }
        ctx.beginPath();
        ctx.moveTo(buf[0], buf[1]);
        for (let j = 1; j < n; j++) ctx.lineTo(buf[2 * j], buf[2 * j + 1]);
        ctx.closePath();
        ctx.fill();
      }
    }
    grownLevel = drawn.length ? grownSum / drawn.length : 1;
  };

  const gust = (direction: 1 | -1) => {
    if (gustStart >= 0 && lastTime - gustStart < opts.gustSeconds * 0.5) return;
    gustStart = lastTime;
    gustDir = direction;
    nextGust = lastTime + opts.gustEvery;
  };

  return { resize, draw, gust, windAt, grown: () => grownLevel, layout };
};
