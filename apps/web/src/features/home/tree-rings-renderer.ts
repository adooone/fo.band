import { createNoise2D } from 'simplex-noise';

/**
 * Річні кільця: a cross-section of a trunk, drawn on a 2D canvas.
 *
 * The screen is dark-green ink. Inside the bark the ground is a shade lighter
 * (heartwood), outside it stays ink, so the screen edges and corners are ink
 * like a window mask. Growth rings are off-white bands: ellipses spaced
 * unevenly (a few tight years), each slightly irregular with a shape shared
 * across the trunk, so they nest like real rings. Each ring is sampled into
 * points along its outline; every frame each point is pushed along its
 * outward normal by simplex noise travelling slowly along the path, with a
 * tiny amplitude and a long wavelength, and the band width swells and thins
 * like an ink line. A soft wind wave crosses the picture every few seconds as
 * a bulge travelling left to right through every ring, and the pith beats
 * gently at sixty a minute.
 */

const TAU = Math.PI * 2;

export type RingsOptions = {
  /** Wobble amplitude in design px (scaled with the viewport). */
  amplitude: number;
  /** Wobble wavelength along the path in design px. */
  wavelength: number;
  /** How fast the wobble travels along the ring, in noise units per second. */
  flow: number;
  /** How fast the wobble shape itself changes, in noise units per second. */
  drift: number;
  /** Distance between sampled points in design px. */
  segment: number;
  /** Stroke half-width in design px. */
  stroke: number;
  /** Stroke thickness variation (0.3 = ±30% around the stroke). */
  thickness: number;
  /** Wavelength of the thickness variation along the path in design px. */
  thicknessWavelength: number;
  /** Mean spacing between rings as a fraction of the outer radius. */
  spacing: number;
  /** Fraction of the outer radius the innermost ring stops at. */
  heart: number;
  /** How far off-centre the pith sits, as a fraction of the outer radius. */
  eccentricity: number;
  /** Static irregularity of the trunk's shape (fraction of the radius). */
  irregularity: number;
  /** Largest half-axis ratio the trunk takes before the ink margins grow. */
  maxRatio: number;
  /** Ink margin around the bark as a fraction of the short screen side. */
  margin: number;
  /** Seconds between two wind waves. */
  windPeriod: number;
  /** Wind bulge amplitude in design px. */
  windAmplitude: number;
  /** Wind bulge half-width as a fraction of the screen width. */
  windWidth: number;
  /** Pith pulse period in seconds (1 = sixty a minute). */
  beatPeriod: number;
  /** How much paper is mixed into the heartwood at the centre and at the bark. */
  heartwood: [number, number];
  /** Seed for the trunk's shape, so it looks the same on every visit. */
  seed: number;
};

export const DEFAULT_OPTIONS: RingsOptions = {
  amplitude: 2.4,
  wavelength: 340,
  flow: 0.1,
  drift: 0.035,
  segment: 4,
  stroke: 1.25,
  thickness: 0.35,
  thicknessWavelength: 520,
  spacing: 0.072,
  heart: 0.085,
  eccentricity: 0.05,
  irregularity: 0.022,
  maxRatio: 1.3,
  margin: 0.045,
  windPeriod: 10,
  windAmplitude: 5,
  windWidth: 0.11,
  beatPeriod: 1,
  heartwood: [0.075, 0.04],
  seed: 7,
};

export const DESIGN = { width: 1440, height: 1024 } as const;

/** Deterministic PRNG so the trunk keeps its shape between visits. */
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

export type GrowthRing = {
  /** Radius as a fraction of the outer (bark) radius. */
  f: number;
  /** Stroke half-width relative to the design stroke. */
  weight: number;
  /** Paper opacity at rest. */
  alpha: number;
  /** Part of a run of tight years. */
  tight: boolean;
};

/**
 * Lays out the rings from the bark inward: uneven spacing around the mean,
 * with runs of two or three tight years, thinner and fainter, like a trunk
 * that had a few hard seasons.
 */
export const growthRings = (
  seed: number,
  spacing = DEFAULT_OPTIONS.spacing,
  heart = DEFAULT_OPTIONS.heart,
): GrowthRing[] => {
  const rng = mulberry32(seed);
  const rings: GrowthRing[] = [
    { f: 1, weight: 2.1, alpha: 0.92, tight: false },
  ];
  let f = 1;
  let tight = 0;
  // A guard against a spacing so small the loop would never end.
  for (let guard = 0; guard < 200; guard++) {
    let step: number;
    let isTight = false;
    if (tight > 0) {
      step = spacing * (0.36 + 0.14 * rng());
      tight--;
      isTight = true;
    } else if (rng() < 0.2) {
      tight = 1 + Math.floor(rng() * 2);
      step = spacing * (0.45 + 0.1 * rng());
      isTight = true;
    } else {
      step = spacing * (0.7 + 0.7 * rng());
    }
    f -= step;
    if (f < heart) break;
    rings.push({
      f,
      weight: isTight ? 0.7 + 0.2 * rng() : 0.85 + 0.55 * rng(),
      alpha: isTight ? 0.5 + 0.12 * rng() : 0.62 + 0.26 * rng(),
      tight: isTight,
    });
  }
  return rings;
};

/** Where the wind wave's centre is, in logical px: off the left edge at the start of each period, off the right at its end. */
export const windX = (
  time: number,
  period: number,
  width: number,
  sigma: number,
): number => {
  const phase = (((time / period) % 1) + 1) % 1;
  return -2 * sigma + (width + 4 * sigma) * phase;
};

/** Smoothstep between two edges. */
const smoothstep = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How much of a ring's opacity it keeps near the heart, where the name sits. */
export const fadeUnderName = (fraction: number): number =>
  0.3 + 0.7 * smoothstep(0.14, 0.42, fraction);

/** Raised-cosine bump, 1 at the centre and 0 beyond ±1. */
export const bump = (u: number): number =>
  u <= -1 || u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * u);

/** Approximate perimeter of an ellipse (Ramanujan). */
export const ellipsePerimeter = (a: number, b: number): number => {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
};

/** A ring's resting outline, flattened: positions, outward normals, arc length. */
export type Outline = {
  n: number;
  x: Float64Array;
  y: Float64Array;
  nx: Float64Array;
  ny: Float64Array;
  s: Float64Array;
  length: number;
};

/**
 * Samples a closed outline of `count` points around (cx, cy): an ellipse with
 * half-axes (a, b) whose radius is scaled by `shape(angle)` for the trunk's
 * irregularity. Normals come from neighbouring points, so they follow the
 * irregular shape, and the arc length is measured on the polygon itself.
 */
export const sampleOutline = (
  cx: number,
  cy: number,
  a: number,
  b: number,
  count: number,
  shape: (angle: number) => number = () => 1,
): Outline => {
  const n = Math.max(8, count);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  const s = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const angle = (j / n) * TAU;
    const r = shape(angle);
    x[j] = cx + a * r * Math.cos(angle);
    y[j] = cy + b * r * Math.sin(angle);
  }
  let length = 0;
  for (let j = 0; j < n; j++) {
    const p = (j + n - 1) % n;
    const q = (j + 1) % n;
    const dx = x[q] - x[p];
    const dy = y[q] - y[p];
    const l = Math.hypot(dx, dy) || 1;
    // Clockwise in screen space (y down): the outward normal is the tangent turned right.
    nx[j] = dy / l;
    ny[j] = -dx / l;
    s[j] = length;
    length += Math.hypot(x[q] - x[j], y[q] - y[j]);
  }
  return { n, x, y, nx, ny, s, length };
};

type RingState = GrowthRing & {
  outline: Outline;
  cx: number;
  cy: number;
  a: number;
  b: number;
  /** Stroke half-width in CSS px. */
  half: number;
  /** Flow direction: neighbouring rings travel opposite ways. */
  direction: 1 | -1;
  /** Hover glow, eased toward its target each frame. */
  hot: number;
  /** Reused scratch buffers, so a frame allocates nothing. */
  outer: Float64Array;
  inner: Float64Array;
};

export type TreeRingsRenderer = {
  resize: (width: number, height: number, dpr: number) => void;
  draw: (time: number) => void;
  /** Where the pointer is (CSS px); the nearest ring glows. null to let go. */
  setPointer: (point: { x: number; y: number } | null) => void;
  /** A ring kept glowing regardless of the pointer (the open section's). */
  setHeld: (ring: number | null) => void;
  /** Index of the ring nearest to a fraction of the outer radius. */
  ringAt: (fraction: number) => number;
  /** Where the pith is after the last layout, in CSS px. */
  pith: () => { x: number; y: number };
  /** Updates options in place, keeping the running animation. */
  setOptions: (options: Partial<RingsOptions>) => void;
  /** 0 = full detail, 1 and 2 trade points and pixels for frame rate. */
  setQuality: (level: 0 | 1 | 2) => void;
};

/** Mixes ink toward paper: t = 0 is ink, 1 is paper. */
export const blend = (t: number): string => {
  const ink = [11, 42, 28];
  const paper = [243, 241, 232];
  const c = ink.map((v, i) => Math.round(v + (paper[i] - v) * t));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
};
export const INK = blend(0);
export const PAPER = blend(1);

const QUALITY_SEGMENT = [1, 1.6, 2.4] as const;
const QUALITY_PIXELS = [1, 0.8, 0.65] as const;

export const createTreeRingsRenderer = (
  canvas: HTMLCanvasElement,
  options: Partial<RingsOptions> = {},
): TreeRingsRenderer | null => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  // The trunk's shape is fixed by the seed; the living wobble has its own noise.
  const shapeNoise = createNoise2D(mulberry32(opts.seed * 31 + 1));
  const noise = createNoise2D(mulberry32(opts.seed * 31 + 2));

  let viewW = 0;
  let viewH = 0;
  let dprScale = 1;
  /** One design pixel in CSS px, floored so lines stay visible on phones. */
  let u = 1;
  let portrait = false;
  /** Trunk centre and outer half-axes. */
  let cx = 0;
  let cy = 0;
  let A = 0;
  let B = 0;
  let rings: RingState[] = [];
  /** Where the pith sits (the rings' centres converge on it). */
  let pithX = 0;
  let pithY = 0;
  let heartwood: CanvasGradient | string = INK;
  let lastW = 0;
  let lastH = 0;
  let lastDpr = 1;
  let qualitySegment = 1;
  let qualityPixels = 1;
  let pointer: { x: number; y: number } | null = null;
  let held: number | null = null;
  let lastTime = 0;

  const layout = () => {
    const w = lastW;
    const h = lastH;
    const dpr = lastDpr * qualityPixels;
    viewW = w;
    viewH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    dprScale = dpr;

    portrait = h > w;
    u = Math.max(
      0.5,
      portrait
        ? Math.min(w / DESIGN.height, h / DESIGN.width)
        : Math.min(w / DESIGN.width, h / DESIGN.height),
    );
    const margin = opts.margin * Math.min(w, h);
    cx = w / 2;
    // On a phone the trunk is fitted to the width and sits a touch above the
    // middle, leaving the bottom strip of ink to the navigation.
    cy = portrait ? h / 2 - 0.04 * h : h / 2;
    if (portrait) {
      A = w / 2 - margin;
      B = Math.min(h / 2 - margin - 0.04 * h, A * opts.maxRatio);
    } else {
      B = h / 2 - margin;
      A = Math.min(w / 2 - margin, B * opts.maxRatio);
    }

    const segment = Math.max(2, opts.segment * u * qualitySegment);
    const grown = growthRings(opts.seed, opts.spacing, opts.heart);
    // The pith sits off-centre, and the rings drift toward it as they shrink.
    const eccAngle = 0.6;
    const ex = Math.cos(eccAngle) * opts.eccentricity * A;
    const ey = Math.sin(eccAngle) * opts.eccentricity * B;
    pithX = cx + ex;
    pithY = cy + ey;
    rings = grown.map((ring, i) => {
      const a = A * ring.f;
      const b = B * ring.f;
      const rcx = cx + ex * (1 - ring.f);
      const rcy = cy + ey * (1 - ring.f);
      const count = Math.round(ellipsePerimeter(a, b) / segment);
      // One slow shape for the whole trunk plus a per-ring wrinkle that
      // changes gradually from ring to ring, so neighbours follow each other.
      const shape = (angle: number) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return (
          1 +
          opts.irregularity *
            (1.0 * shapeNoise(1.3 * c + 10, 1.3 * s + 10) +
              0.5 * shapeNoise(2.6 * c + 20 + i * 0.45, 2.6 * s + 20))
        );
      };
      const outline = sampleOutline(rcx, rcy, a, b, count, shape);
      const have = rings[i];
      const size = 2 * outline.n + 2;
      return {
        ...ring,
        outline,
        cx: rcx,
        cy: rcy,
        a,
        b,
        half: opts.stroke * u * ring.weight,
        direction: i % 2 === 0 ? 1 : -1,
        hot: have?.hot ?? 0,
        outer:
          have && have.outer.length >= size
            ? have.outer
            : new Float64Array(size),
        inner:
          have && have.inner.length >= size
            ? have.inner
            : new Float64Array(size),
      };
    });

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(A, B));
    g.addColorStop(0, blend(opts.heartwood[0]));
    g.addColorStop(1, blend(opts.heartwood[1]));
    heartwood = g;
  };

  const resize = (w: number, h: number, dpr: number) => {
    lastW = w;
    lastH = h;
    lastDpr = dpr;
    layout();
  };

  /** The ring the pointer is nearest to, or null outside the bark. */
  const nearest = (): number | null => {
    if (!pointer || rings.length === 0) return null;
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const rho = Math.hypot(
        (pointer.x - r.cx) / r.a,
        (pointer.y - r.cy) / r.b,
      );
      if (i === 0 && rho > 1.06) return null;
      const dist = Math.abs(rho - 1) * r.f;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  const draw = (time: number) => {
    if (viewW === 0 || viewH === 0 || rings.length === 0) return;
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;

    // Hover glow eases in quickly and lingers on the way out; the rings
    // beside the lit one get a little of it, so the light has a soft edge.
    const hotRing = nearest();
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      let target = 0;
      if (i === hotRing || i === held) target = 1;
      else if (
        (hotRing !== null && Math.abs(i - hotRing) === 1) ||
        (held !== null && Math.abs(i - held) === 1)
      )
        target = 0.3;
      const tau = target > r.hot ? 0.3 : 0.9;
      r.hot += (target - r.hot) * (1 - Math.exp(-dt / tau));
    }

    ctx.setTransform(dprScale, 0, 0, dprScale, 0, 0);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, viewW, viewH);

    const amp = opts.amplitude * u;
    const sigma = opts.windWidth * viewW;
    const wx = windX(time, opts.windPeriod, viewW, sigma);
    // Gusts: the wave is a little stronger or weaker each time it passes.
    const gust = 0.75 + 0.25 * noise(time * 0.07, 77);
    const windAmp = opts.windAmplitude * u * gust;
    // The pith beats at sixty a minute: a short soft pulse once a period.
    const beat = (0.5 - 0.5 * Math.cos((time / opts.beatPeriod) * TAU)) ** 4;

    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const { n, x, y, nx, ny, s, length } = r.outline;
      const { outer, inner } = r;
      // The noise is sampled along circles in noise space, so it is periodic
      // in the arc length and the band closes without a seam. The circle
      // radius sets the wavelength; rotating the circle over time makes the
      // wobble travel. The spin is measured against the ring's resting
      // length (its outline never changes here, but a ring whose length
      // changed would otherwise make the waves race by time × the change).
      const restR1 = length / (opts.wavelength * u * TAU);
      const r1 = restR1;
      const r2 = r1 / 2.6;
      const r3 = length / (opts.thicknessWavelength * u * TAU);
      const spin = (r.direction * time * opts.flow) / restR1;
      const ox = i * 7.3 + time * opts.drift;
      const oy = i * 3.7;
      const windHere = windAmp * (0.55 + 0.45 * r.f);
      const half = r.half * (1 + 0.9 * r.hot);
      for (let j = 0; j < n; j++) {
        const theta = (s[j] / length) * TAU - spin;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        // Two octaves: a fine ripple plus a slower, larger swell.
        const wobble =
          amp *
          (0.6 * noise(r1 * cos + ox, r1 * sin + oy) +
            0.5 * noise(r2 * cos + ox + 40, r2 * sin + oy + 40));
        // The wind: a soft bulge with a steeper front and a longer tail.
        const dx = x[j] - wx;
        const wind = bump(dx / (dx > 0 ? sigma * 0.8 : sigma * 1.25));
        const d = wobble + wind * windHere;
        // Thickness swells slowly along the path, travels with the flow, and
        // thickens a touch inside the wind.
        const theta3 = (s[j] / length) * TAU - spin * 0.3;
        const w =
          half *
          (1 +
            opts.thickness *
              noise(
                r3 * Math.cos(theta3) + ox + 90,
                r3 * Math.sin(theta3) + 90,
              )) *
          (1 + 0.25 * wind);
        const px = x[j] + nx[j] * d;
        const py = y[j] + ny[j] * d;
        outer[2 * j] = px + nx[j] * w;
        outer[2 * j + 1] = py + ny[j] * w;
        inner[2 * j] = px - nx[j] * w;
        inner[2 * j + 1] = py - ny[j] * w;
      }
      const count = 2 * n + 2;
      // Repeat the first point so the band also covers the closing segment.
      outer[2 * n] = outer[0];
      outer[2 * n + 1] = outer[1];
      inner[2 * n] = inner[0];
      inner[2 * n + 1] = inner[1];

      if (i === 0) {
        // The bark is the window: the heartwood ground fills everything
        // inside its inner edge; outside stays ink to the screen edges.
        ctx.fillStyle = heartwood;
        ctx.beginPath();
        ctx.moveTo(inner[0], inner[1]);
        for (let j = 2; j < count; j += 2) ctx.lineTo(inner[j], inner[j + 1]);
        ctx.closePath();
        ctx.fill();
      }

      // The band is the outer edge minus the inner edge (even-odd, two closed
      // subpaths), so there is no cut across the band where the loop closes.
      // The rings under the name fade into the heartwood so it stays readable.
      ctx.fillStyle = PAPER;
      ctx.globalAlpha = (r.alpha + (1 - r.alpha) * r.hot) * fadeUnderName(r.f);
      ctx.beginPath();
      ctx.moveTo(outer[0], outer[1]);
      for (let j = 2; j < count; j += 2) ctx.lineTo(outer[j], outer[j + 1]);
      ctx.closePath();
      ctx.moveTo(inner[0], inner[1]);
      for (let j = 2; j < count; j += 2) ctx.lineTo(inner[j], inner[j + 1]);
      ctx.closePath();
      ctx.fill('evenodd');
    }

    // The pith: a small dot at the heart that beats.
    ctx.globalAlpha = 0.85 + 0.15 * beat;
    ctx.beginPath();
    ctx.arc(pithX, pithY, opts.stroke * u * (2.2 + 0.5 * beat), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const setPointer = (point: { x: number; y: number } | null) => {
    pointer = point;
  };
  const setHeld = (ring: number | null) => {
    held = ring;
  };
  const ringAt = (fraction: number): number => {
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < rings.length; i++) {
      const dist = Math.abs(rings[i].f - fraction);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };
  const setOptions = (next: Partial<RingsOptions>) => {
    Object.assign(opts, next);
    if (lastW > 0 && lastH > 0) layout();
  };
  const setQuality = (level: 0 | 1 | 2) => {
    if (
      qualitySegment === QUALITY_SEGMENT[level] &&
      qualityPixels === QUALITY_PIXELS[level]
    )
      return;
    qualitySegment = QUALITY_SEGMENT[level];
    qualityPixels = QUALITY_PIXELS[level];
    if (lastW > 0 && lastH > 0) layout();
  };

  const pith = () => ({ x: pithX, y: pithY });

  return {
    resize,
    draw,
    setPointer,
    setHeld,
    ringAt,
    pith,
    setOptions,
    setQuality,
  };
};
