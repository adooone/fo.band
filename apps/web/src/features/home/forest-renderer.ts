import { createNoise2D } from 'simplex-noise';
import { clamp01, ease } from './easing';
import {
  flatShape,
  leafShape,
  mushroomGroup,
  STUMP,
  stumpShape,
  stumpTop,
  TRUNK_EDGE_POINTS,
  trunkOutline,
} from './forms';
import {
  LOGO_F,
  LOGO_F_SPINE,
  LOGO_O,
  LOGO_ROOT,
  LOGO_VIEWBOX,
} from './logo-paths';
import { flattenPath, type Outline, outlineOf } from './path-outline';
import { mulberry32 } from './rng';
import { bindOutline, buildSpine, sproutOutline, sproutPose } from './sprout';

/**
 * The forest: the lower part of the screen is ink, the sky above is paper,
 * and the edge between them is one continuous line, as if drawn without
 * lifting the pencil. It runs along a wavy ground of hills, highest in the
 * middle under the mark,
 * and at every tree it climbs the outline, goes over the crown and comes
 * back down: round and oval crowns on short trunks, soft spruces, bushes,
 * each standing on its own. Every outline has as many points as a plain
 * mound, so on load the forest morphs out of a flat line: the hills swell,
 * the line bulges into mounds and each mound grows into its tree, from the
 * middle outward. Trees lean
 * with a wind that drifts and gusts, the ground breathes.
 */

const TAU = Math.PI * 2;
/** Pitch of the per-frame tables of the ground's slow parts, CSS px. */
const SLOW_PITCH = 12;

export type TreeKind =
  | 'round'
  | 'oval'
  | 'spruce'
  | 'bush'
  /** A wavy oak-leaf crown on a slender stalk, the oak leaf grown into a tree. */
  | 'oak'
  /**
   * The f of the mark: it sprouts out of the ground in the skyline, sinks
   * back into it on the music page and turns into a leaf on finds.
   */
  | 'mark'
  /** The record player's stump, growing out of the ground on the music page. */
  | 'stump';

/** The four places of the site; the forest takes a different form on each. */
export type PageId = 'home' | 'music' | 'finds' | 'about';
/**
 * Every change but music's starts the same way: the forest hides (the
 * trees sink into the ground; on finds the mark too), the far hills and
 * the clouds fading. The hills stay as they are.
 */
const BARE_SECONDS = 0.45;
/** The next stage starts this long after the forest began to hide. */
const BARE_LEAD = 0.4;
/**
 * The about page: once the forest has gone, the horizon is drawn up until
 * it is this far down the screen, a thin strip of sky over the land, the
 * left half a little ahead of the right; the mark rides up on it in the
 * middle, shrinking to this scale.
 */
const ABOUT_HORIZON = 0.12;
const ABOUT_SECONDS = 0.8;
/** Share of the rise by which the right edge trails the left. */
const ABOUT_UNEVEN = 0.25;
const ABOUT_MARK = 0.22;
/**
 * The mark follows the horizon's move with a little inertia: its top is a
 * weight on a soft spring over its foot, so it squashes as the ground
 * pulls it up and stretches as the ground stops, then settles. The
 * spring's frequency (Hz), damping (1 is none past the rest), how much it
 * feels the ground's pull, and the most it ever squashes or stretches.
 */
const MARK_SPRING_HZ = 2.2;
const MARK_SPRING_DAMPING = 0.55;
const MARK_SPRING_GAIN = 0.6;
const MARK_SPRING_MAX = 0.14;
/** Birds take off from the trees as the forest hides, and fly this long. */
const BIRDS_SECONDS = 3.2;
/** How close the music page draws in to the forest floor. */
const MUSIC_ZOOM = 2.1;
/**
 * On the finds page the land turns into a tree trunk this wide (of the
 * width), on the left of the screen: the trunk is built for the right
 * and mirrored.
 */
export const FINDS_STRIP = 1 / 6;
/**
 * The finds page in stages: once the forest has gone the camera dives into
 * the land, about a point this far (of the height) under the horizon, until
 * the screen is all ink; then the ink's edge is drawn in from the right of
 * the screen into the trunk's edge, the top a little ahead of the bottom.
 * The way back unwinds in the same order.
 */
const FINDS_SINK_SECONDS = 0.45;
const DIVE_SECONDS = 0.85;
const DIVE_DEPTH = 0.08;
const DIVE_ZOOM = 14;
/**
 * Halfway through the dive the left of the horizon is ahead of the right
 * by this much of the height (on screen), the line bending smoothly
 * between them; the gap closes as the screen fills.
 */
const DIVE_LEAD = 0.4;
const CURTAIN_SECONDS = 0.9;
/** Share of the pull by which the bottom of the edge trails the top. */
const CURTAIN_UNEVEN = 0.25;
/** The skyline takes this much of the pencil's run; the rest is the o. */
const PENCIL_MEET = 0.86;
/**
 * Page changes are quick and organic: the scene draws in or turns, and
 * every point of every outline starts on its own beat (tops and tips
 * first). Every curve eases in and out with no overshoot. Nothing slides:
 * every page is the same forest in another pose.
 */
const SCENE_SECONDS = 0.95;
const PAGE_MORPH_SECONDS = 0.75;
/** Share of a morph over which the points' starts are spread. */
const MORPH_STAGGER = 0.45;

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
  /** Share of oak-leaf trees among the rest, 0..1. */
  oaks: number;
  /** Bushes per tree. */
  bushes: number;
  /** Trunk height of round trees, fraction of the tree. */
  trunk: number;
  /** Wind strength multiplier. */
  wind: number;
  /** Seconds between two gusts of wind. */
  gustEvery: number;
  /** How long a gust takes to cross the screen. */
  gustSeconds: number;
  /** Seconds of one breath of the whole forest. */
  breathSeconds: number;
  /** How long the morph from the flat line takes, per tree. */
  morphSeconds: number;
  /** Extra delay for the trees at the edges, seconds. */
  morphStagger: number;
  /** Seed for the forest, so it is the same forest on every visit. */
  seed: number;
  /**
   * The far hills behind the horizon: how much ink is in their tint, how
   * high they stand above the horizon in the middle (of the height), how
   * much higher at the edges (the valley under the mark), and the size of
   * their little trees.
   */
  farTint: number;
  farHeight: number;
  farDip: number;
  farTrees: number;
  /**
   * The pencil that traces the skyline on every change: how long it takes
   * to cross the line, how long its trail is (of the line), how far it
   * wanders off the silhouette (in u) over how long a wave (in u), and how
   * thick it draws (in u).
   */
  pencilSeconds: number;
  pencilTrail: number;
  pencilWander: number;
  pencilWave: number;
  pencilWidth: number;
  /**
   * Life in the sky of the home page: how many small clouds drift along
   * the top, how big (of the width), how fast (u per second) and how much
   * ink is in them; and the birds that cross now and then: seconds between
   * flights, how many in a flight, their size (u) and speed (widths per
   * second).
   */
  clouds: number;
  /** A second, farther layer behind them: paler, smaller, slower. */
  farClouds: number;
  /** Where the clouds hang: this far down the screen (of the height), and a little lower. */
  cloudTop: number;
  cloudSize: number;
  cloudSpeed: number;
  cloudTint: number;
  birdsEvery: number;
  birdsCount: number;
  /** How high over the horizon the birds cross (of the height). */
  birdsAbove: number;
  birdSize: number;
  birdSpeed: number;
};

export const DEFAULT_OPTIONS: ForestOptions = {
  horizon: 0.8,
  hill: 0.055,
  waves: 0.005,
  waveCount: 7.1,
  treeMax: 0.18,
  treeMin: 0.23,
  gap: 0.15,
  clearing: 0,
  spruces: 0.4,
  oaks: 0.4,
  bushes: 0,
  trunk: 0.16,
  wind: 3,
  gustEvery: 8,
  gustSeconds: 8.8,
  breathSeconds: 12,
  morphSeconds: 1.5,
  morphStagger: 2,
  seed: 9,
  farTint: 0.2,
  farHeight: 0.04,
  farDip: 0.025,
  farTrees: 0.35,
  pencilSeconds: 5,
  pencilTrail: 0.6,
  pencilWander: 4,
  pencilWave: 600,
  pencilWidth: 2,
  clouds: 3,
  farClouds: 5,
  cloudTop: 0.16,
  cloudSize: 0.1,
  cloudSpeed: 11.5,
  cloudTint: 0.05,
  birdsEvery: 4,
  birdsCount: 3,
  birdsAbove: 0.3,
  birdSize: 5,
  birdSpeed: 0.15,
};

/** Raised-cosine bump, 1 at the centre and 0 beyond ±1. */
export const bump = (u: number): number =>
  u <= -1 || u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * u);

/** Points per tree outline; the mound has the same count, so they can morph. */
export const POINTS = 96;
/** Points on the f's outline, finer than a tree's: it is the biggest thing in the line. */
export const MARK_POINTS = 192;
/** The stump's height as a share of the mark's: the music page draws in, so it is drawn small. */
const STUMP_SHARE = 0.27;
/** The f is cut off at the ground this far above the tip of its stem (viewBox units). */
const MARK_CUT = 21.4;

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
  /** Points on its outline. */
  n: number;
  /** Position across the screen in CSS px. */
  x: number;
  /** Height in CSS px. */
  h: number;
  /** Width in CSS px. */
  w: number;
  seed: number;
  /** Seconds before this tree starts morphing. */
  delay: number;
  /** How long its current page morph takes. */
  seconds: number;
  /**
   * Whether the current morph goes in two stages, sinking into the ground
   * and growing back out as the new form, instead of point to point: for
   * forms with nothing in common, like a tree and a mushroom.
   */
  twoStage: boolean;
  /**
   * The outline on each page, as open paths from the left end of the base,
   * up and over (or down and round, for roots), to the right end (local
   * units: 1 = the tree's height, base at the origin, y down). The ground
   * line it is spliced into closes it.
   */
  forms: Record<PageId, number[]>;
  /** The plain mound it grows from on load, same point count and ends. */
  mound: number[];
  /** The morph between pages: from this outline to `forms[to]`. */
  from: Float64Array;
  to: PageId;
  start: number;
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
  /** The home page's ground line at rest, at a screen x (CSS px). */
  groundY: (x: number) => number;
};

export type ForestRenderer = {
  resize: (width: number, height: number, dpr: number) => void;
  /** Changes only the canvas's pixel density, for adaptive quality. */
  setPixelRatio: (dpr: number) => void;
  draw: (time: number) => void;
  /** Updates options in place; the forest is replanted when its layout changes. */
  setOptions: (options: Partial<ForestOptions>) => void;
  /** Updates the mark's size and the o's place, which set the clearing and the root. */
  setMark: (mark: MarkOptions) => void;
  /** Plays the intro again: the forest morphs out of the line, the f sprouts. */
  restart: () => void;
  /** Goes to a page: the scene takes its pose and the forest its forms. */
  setPage: (page: PageId, instant?: boolean) => void;
  /** Sends a gust across the forest from the left (+1) or the right (−1). */
  gust: (direction: 1 | -1) => void;
  /** Wind strength at a screen x right now, about −1..1 (positive blows right). */
  windAt: (x: number) => number;
  layout: () => ForestLayout;
};

export const INK = '#2d493a';
export const PAPER = '#f7f6f1';
/** Paper with this much ink in it, as a CSS colour. */
const tinted = (ink: number): string => {
  const mix = (at: number) => {
    const a = Number.parseInt(PAPER.slice(at, at + 2), 16);
    const b = Number.parseInt(INK.slice(at, at + 2), 16);
    return Math.round(a + (b - a) * ink)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${mix(1)}${mix(3)}${mix(5)}`;
};
/** The pencil line's graphite: the one colour besides ink and paper. */
export const PENCIL = '#111111';

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
  oScale: 0.66,
  markWobble: 0,
  markBreath: 15,
  sproutSeconds: 5,
  coil: 5,
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
/** Where the ground cuts the f's stem: on its spine, `MARK_CUT` above the tip. */
const F_CUT = (() => {
  const y = F_SPINE.y[0] - MARK_CUT;
  let k = 0;
  while (k + 2 < F_SPINE.n && F_SPINE.y[k + 1] > y) k++;
  const t = (F_SPINE.y[k] - y) / (F_SPINE.y[k] - F_SPINE.y[k + 1] || 1);
  return { x: F_SPINE.x[k] + (F_SPINE.x[k + 1] - F_SPINE.x[k]) * t, y };
})();
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
  /** The f, planted in the skyline like a tree. */
  let markTree: Tree | null = null;
  let stumpTree: Tree | null = null;
  let buffer = new Float64Array(Math.max(MARK_POINTS, MARK_F.n) * 2);
  /** The f's outline for one frame, in viewBox units. */
  const fBuffer = new Float64Array(MARK_F.n * 2);
  /** The f's form before it has broken ground: nothing. */
  const markFlat = resampleOpen(flatShape(0.2), MARK_POINTS);
  /** The o as drawn this frame, on screen, for the pencil to trace. */
  const markO = new Float64Array(MARK_O.n * 2);
  let markODrawn = false;
  /** One tree's current outline, local units. */
  const shape = new Float64Array(MARK_POINTS * 2);
  /** The whole skyline for one frame: ground and trees as one line. */
  let line = new Float64Array(0);
  /** The tree the land turns into on the finds page: its outline on screen. */
  let trunk = new Float64Array(0);
  /** Where each point of the trunk's edge waits off the right of the screen, 0..1 of the pull. */
  let trunkLag = new Float64Array(0);
  let W = 0;
  let H = 0;
  let dprScale = 1;
  let lastDpr = 1;
  /** One design pixel in CSS px (1 at 1024 tall), floored for phones. */
  let u = 1;
  let groundX = new Float64Array(0);
  /** The far treeline's little trees, as heights (px) over the far hills at every ground sample. */
  let farBumps = new Float64Array(0);
  /** The forest floor seen close on the music page: tufts and little plants along the ground. */
  let floorBumps = new Float64Array(0);
  let farColour = tinted(opts.farTint);
  /**
   * The slowly varying part of the ground (hills and breath)
   * and the wind, tabled once a frame at a coarse pitch and read back by
   * interpolation: they change over tens of pixels.
   */
  let slow = new Float64Array(0);
  let slowWind = new Float64Array(0);
  let slowX0 = 0;
  let lastTime = 0;
  /** When the intro began, on the renderer's clock. */
  let introStart = 0;
  let gustStart = -1;
  let gustDir: 1 | -1 = 1;
  let nextGust = 6;
  let page: PageId = 'home';
  /**
   * How far each stage of a page change has gone, animated: the forest
   * hidden; the horizon drawn up for about; the
   * scene drawn in for music; the dive into the land, and its edge drawn
   * in to the trunk, for finds.
   */
  const bare = { from: 0, to: 0, start: -1e9 };
  /** How far the o has set for finds. */
  const oSet = { from: 0, to: 0, start: -1e9 };
  const rooted = { from: 0, to: 0, start: -1e9 };
  const musical = { from: 0, to: 0, start: -1e9 };
  const dived = { from: 0, to: 0, start: -1e9 };
  const leafy = { from: 0, to: 0, start: -1e9 };
  /** When the pencil last set off: on a page change, or once the intro has grown. */
  let pencilStart = opts.morphSeconds + opts.morphStagger * 0.5;
  /** Eases out and settles with a touch of give, no more than 3% past. */
  const settle = (p: number) => {
    const c1 = 0.5;
    return 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2;
  };
  /** When the birds last took off, and the tree tops they take off from (world px). */
  let birdsLaunch = -1e9;
  /** The mark's squash (−) and stretch (+), its rate, and the foot's last place and speed. */
  const markSpring = { s: 0, v: 0, y: 0, vy: 0, at: -1 };
  let birdStarts: { x: number; y: number }[] = [];
  /** The clouds along the top of the sky, and the birds crossing it. */
  type Cloud = {
    x0: number;
    y: number;
    size: number;
    /** Its outline, a closed loop in px about its centre. */
    shape: Float64Array;
    drift: number;
    /** On the far layer: paler, smaller, slower. */
    far: boolean;
  };
  const CLOUD_POINTS = 48;
  let farCloudColour = tinted(opts.cloudTint * 0.5);
  let clouds: Cloud[] = [];
  let cloudColour = tinted(opts.cloudTint);
  type Flight = {
    start: number;
    from: 1 | -1;
    y: number;
    count: number;
    seed: number;
  };
  let flight: Flight | null = null;
  let nextFlight = 8;
  const level = (
    v: { from: number; to: number; start: number },
    t: number,
    seconds: number,
    curve: (p: number) => number = ease,
  ) => v.from + (v.to - v.from) * curve(clamp01((t - v.start) / seconds));

  /**
   * The resting ground line at a world x: hills highest in the middle of
   * every page, with smaller waves.
   */
  const groundRest = (x: number): number => {
    const c = (x - W / 2) / (W / 2);
    const hill = opts.hill * H * (0.5 + 0.5 * Math.cos(Math.PI * c));
    const wave = opts.waves * H * Math.sin(Math.PI * opts.waveCount * c + 0.7);
    return opts.horizon * H - (hill + wave);
  };

  /** Where the f's root is (its x and the mark's height). */
  const markRoot = () => {
    const logoH = logoHeight(W, H, markOpts.logo);
    const rootOffset =
      ((LOGO_VIEWBOX.w + markOpts.oShift) / 2 -
        (LOGO_ROOT.x - LOGO_VIEWBOX.x)) /
      LOGO_VIEWBOX.h;
    return { x: W / 2 - rootOffset * logoH, logoH };
  };
  /** Where the f's stem meets the ground (CSS px). */
  const markFoot = () => {
    const { x, logoH } = markRoot();
    return { x: x + ((F_CUT.x - LOGO_ROOT.x) * logoH) / LOGO_VIEWBOX.h, logoH };
  };

  /**
   * The outline of a tree at time t, local units, into `out`. Each point
   * starts on its own beat: the ones furthest from the ground (crowns, tips
   * of leaves) first, the foot last, so the shape pours into its new form
   * instead of fading.
   */
  const formAt = (tree: Tree, t: number, out: Float64Array | number[]) => {
    const a = tree.from;
    const b = tree.forms[tree.to];
    const elapsed = (t - tree.start) / tree.seconds;
    const n = tree.n;
    if (elapsed >= 1) {
      for (let k = 0; k < n * 2; k++) out[k] = b[k];
      return;
    }
    if (tree.twoStage) {
      // Down into the ground whole, a beat, then up out of it whole, the
      // new form settling into place with a touch of give.
      const sink = ease(clamp01(elapsed / 0.45));
      const grow = settle(clamp01((elapsed - 0.45) / 0.55));
      const src = sink < 1 ? a : b;
      const k = sink < 1 ? 1 - sink : grow;
      for (let j = 0; j < n * 2; j++) out[j] = src[j] * k;
      return;
    }
    let reachA = 0;
    let reachB = 0;
    for (let j = 0; j < n; j++) {
      reachA = Math.max(reachA, Math.abs(a[2 * j + 1]));
      reachB = Math.max(reachB, Math.abs(b[2 * j + 1]));
    }
    const reach = Math.max(1e-6, reachA, reachB);
    // The f sinks into the ground and grows back out of it whole, shrinking
    // about its foot, rather than pouring in top first like a tree.
    const stagger =
      tree.kind === 'mark' && Math.min(reachA, reachB) < 2e-3
        ? 0
        : MORPH_STAGGER;
    for (let j = 0; j < n; j++) {
      const far =
        Math.max(Math.abs(a[2 * j + 1]), Math.abs(b[2 * j + 1])) / reach;
      const key = 1 - far;
      const p = ease(clamp01((elapsed - key * stagger) / (1 - stagger)));
      out[2 * j] = a[2 * j] + (b[2 * j] - a[2 * j]) * p;
      out[2 * j + 1] = a[2 * j + 1] + (b[2 * j + 1] - a[2 * j + 1]) * p;
    }
  };

  /**
   * Plants the forest three screens wide (the music page draws in, so the
   * edges must hold), with a clearing in the middle for the mark, where the
   * record player's stump grows on the music page. Every tree knows its
   * form on every page.
   */
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
    const add = (
      kind: TreeKind,
      x: number,
      h: number,
      w: number,
      seed: number,
      delay: number,
      forms: Record<PageId, number[]>,
      n = POINTS,
    ) => {
      const sampled = Object.fromEntries(
        (Object.keys(forms) as PageId[]).map((k) => [
          k,
          resampleOpen(forms[k], n),
        ]),
      ) as Record<PageId, number[]>;
      list.push({
        kind,
        n,
        x,
        h,
        w,
        seed,
        delay,
        seconds: PAGE_MORPH_SECONDS,
        twoStage: false,
        forms: sampled,
        mound: resampleOpen(moundShape(w / h), n),
        from: Float64Array.from(sampled[page]),
        to: page,
        start: -1e9,
      });
    };
    const kinds: TreeKind[] = ['round', 'oval'];
    const place = (side: 1 | -1, until: number) => {
      let x = W / 2 + side * clearing;
      let prevW = 0;
      while (side > 0 ? x < until : x > until) {
        const spruce = rng() < opts.spruces;
        const oak = rng() < opts.oaks;
        const kind: TreeKind = spruce
          ? 'spruce'
          : oak
            ? 'oak'
            : kinds[Math.floor(rng() * 2)];
        const h = minH + (maxH - minH) * rng();
        // Width for spacing: a cone's base, a crown's diameter.
        const w =
          h *
          (kind === 'spruce'
            ? 0.45 + 0.15 * rng()
            : kind === 'oak'
              ? 0.4
              : kind === 'oval'
                ? 0.8 * (1 - opts.trunk)
                : 1.08 * (1 - opts.trunk));
        // Nothing in a forest is evenly spaced: the gaps vary a lot, and
        // now and then one opens wider.
        const meanW = (prevW + w) / 2 || w;
        const open = rng() < 0.12 ? (0.6 + rng()) * meanW : 0;
        x +=
          side *
          (prevW / 2 + opts.gap * meanW * (0.3 + 1.4 * rng()) + open + w / 2);
        prevW = w;
        const seed = rng() * 100;
        const tree =
          kind === 'oak'
            ? leafShape(seed, 1, 'oak', opts.trunk)
            : treeShape(kind, w / h, seed, opts.trunk, blobNoise);
        // Mushrooms grow where they like: some trees leave bare ground.
        const music =
          rng() < 0.22 ? flatShape(w / h) : mushroomGroup(seed, w / h);
        add(
          kind,
          x,
          h,
          w,
          seed,
          0.3 +
            (opts.morphStagger * Math.abs(x - W / 2)) / (W / 2) +
            0.15 * rng(),
          {
            home: tree,
            music,
            // The forest hides on about and finds.
            finds: flatShape(w / h),
            about: flatShape(w / h),
          },
        );
      }
    };
    place(1, 2 * W + 0.1 * S);
    place(-1, -W - 0.1 * S);
    // The f of the mark, in the line like a tree: it sprouts, so its form
    // on the home and about pages is written every frame (`growMark`); on
    // the music and finds pages it sinks back into the ground. Never a
    // mound: the sprout is its own intro.
    const foot = markFoot();
    add(
      'mark',
      foot.x,
      logoH,
      logoWidth(logoH, markOpts.oShift),
      7,
      -opts.morphSeconds,
      {
        home: flatShape(0.2),
        music: flatShape(0.2),
        finds: flatShape(0.2),
        about: flatShape(0.2),
      },
      MARK_POINTS,
    );
    // The record player's stump: flat everywhere but on the music page,
    // where it grows out of the ground in the middle once the f has gone.
    const stumpH = STUMP_SHARE * logoH;
    add('stump', W / 2, stumpH, stumpH * STUMP.width, 7, 0, {
      home: flatShape(STUMP.width),
      music: stumpShape(STUMP.width),
      finds: flatShape(STUMP.width),
      about: flatShape(STUMP.width),
    });
    // Left to right, the order the skyline walks them in.
    trees = list.sort((a, b) => a.x - b.x);
    // The four trees nearest the clearing: where the birds sit.
    const sky = mulberry32(opts.seed * 41 + 3);
    const cloudNoise = createNoise2D(mulberry32(opts.seed * 43 + 9));
    clouds = [];
    for (let i = 0; i < opts.clouds + opts.farClouds; i++) {
      const far = i >= opts.clouds;
      const size = opts.cloudSize * W * (0.7 + 0.6 * sky()) * (far ? 0.55 : 1);
      // A soft, wide blob: a flat ellipse whose edge wanders with noise in
      // two octaves, heavier on top where the cloud billows, calmer below.
      const shape = new Float64Array(CLOUD_POINTS * 2);
      const wide = 2.2 + 1.2 * sky();
      const ox = sky() * 100;
      for (let k = 0; k < CLOUD_POINTS; k++) {
        const a = (k / CLOUD_POINTS) * TAU;
        const up = Math.max(0, -Math.sin(a));
        const ripple =
          0.22 * cloudNoise(1.3 * Math.cos(a) + ox, 1.3 * Math.sin(a) + ox) +
          0.1 * cloudNoise(3.1 * Math.cos(a) + ox + 7, 3.1 * Math.sin(a) + ox);
        const r = 1 + ripple * (0.5 + 0.9 * up);
        shape[2 * k] = Math.cos(a) * size * wide * 0.5 * r;
        shape[2 * k + 1] = Math.sin(a) * size * 0.5 * r * (up > 0 ? 1 : 0.55);
      }
      clouds.push({
        x0: sky() * W,
        y: H * (opts.cloudTop + 0.12 * sky() - (far ? 0.04 : 0)),
        size,
        shape,
        drift: (0.7 + 0.6 * sky()) * (far ? 0.4 : 1),
        far,
      });
    }
    // The far ones first, so the near ones pass in front of them.
    clouds.sort((a, b) => Number(b.far) - Number(a.far));
    cloudColour = tinted(opts.cloudTint);
    farCloudColour = tinted(opts.cloudTint * 0.5);
    birdStarts = trees
      .filter((t) => t.kind !== 'mark' && t.kind !== 'stump')
      .sort((a, b) => Math.abs(a.x - W / 2) - Math.abs(b.x - W / 2))
      .slice(0, 4)
      .map((t) => ({ x: t.x, y: groundRest(t.x) - t.h }));
    plantFar();
    markTree = trees.find((t) => t.kind === 'mark') ?? null;
    stumpTree = trees.find((t) => t.kind === 'stump') ?? null;
    const points = trees.reduce((sum, t) => sum + t.n, 0);
    line = new Float64Array((groundX.length + points + 4) * 2);
  };

  /**
   * The far treeline: a close row of little spruces and round crowns along
   * the far hills, baked as heights over every ground sample. Far away,
   * they stand still.
   */
  /**
   * A line of little pointed and round shapes along the ground, baked as
   * heights over every ground sample: the far treeline, and the tufts of
   * the forest floor seen close on the music page.
   */
  const treeline = (
    seed: number,
    width: (spruce: boolean) => number,
    height: (spruce: boolean) => number,
  ): Float64Array<ArrayBuffer> => {
    const rng = mulberry32(seed);
    const bumps = new Float64Array(groundX.length);
    if (groundX.length < 2) return bumps;
    const step = groundX[1] - groundX[0];
    let x = groundX[0];
    const end = groundX[groundX.length - 1];
    while (x < end) {
      const spruce = rng() < 0.55;
      const w = width(spruce) * (0.8 + 0.4 * rng());
      const h = height(spruce) * (0.7 + 0.6 * rng());
      const i0 = Math.max(0, Math.floor((x - w / 2 - groundX[0]) / step));
      const i1 = Math.min(
        groundX.length - 1,
        Math.ceil((x + w / 2 - groundX[0]) / step),
      );
      for (let i = i0; i <= i1; i++) {
        const d = Math.abs(groundX[i] - x) / (w / 2);
        if (d >= 1) continue;
        const bump = spruce ? h * (1 - d) : h * Math.sqrt(1 - d * d);
        if (bump > bumps[i]) bumps[i] = bump;
      }
      x += w * (0.55 + 0.5 * rng());
    }
    return bumps;
  };
  const plantFar = () => {
    farColour = tinted(opts.farTint);
    farBumps = treeline(
      opts.seed * 31 + 5,
      (spruce) => u * (spruce ? 11.5 : 14.5),
      (spruce) => u * opts.farTrees * (spruce ? 17 : 11),
    );
    // Smaller and closer: grass tufts and seedlings at the stump's foot
    // (the music page draws in, so they are drawn small).
    floorBumps = treeline(
      opts.seed * 37 + 11,
      (spruce) => u * (spruce ? 4 : 5.5),
      (spruce) => u * (spruce ? 6.5 : 3.6),
    );
  };

  const linear = (p: number) => p;
  /** Each stage's value now; the uneven ones run linear and ease per point. */
  const stageAt = {
    bare: (t: number) => level(bare, t, BARE_SECONDS),
    rooted: (t: number) => level(rooted, t, ABOUT_SECONDS, linear),
    musical: (t: number) => level(musical, t, SCENE_SECONDS),
    dived: (t: number) => level(dived, t, DIVE_SECONDS, linear),
    leafy: (t: number) => level(leafy, t, CURTAIN_SECONDS, linear),
  };

  const setPage = (next: PageId, instant = false) => {
    const now = lastTime;
    const stages = { bare, rooted, musical, dived, leafy };
    const keys = Object.keys(stages) as (keyof typeof stages)[];
    const hides = next === 'about' || next === 'finds';
    const target: Record<keyof typeof stages, boolean> = {
      bare: hides,
      rooted: next === 'about',
      musical: next === 'music',
      dived: next === 'finds',
      leafy: next === 'finds',
    };
    if (instant) {
      page = next;
      for (const key of keys) {
        stages[key].from = stages[key].to = target[key] ? 1 : 0;
      }
      oSet.from = oSet.to = next === 'finds' ? 1 : 0;
      for (const tree of trees) {
        tree.from = Float64Array.from(tree.forms[next]);
        tree.to = next;
        tree.start = -1e9;
      }
      return;
    }
    if (next === page) return;
    for (const key of keys) {
      stages[key].from = stageAt[key](now);
      stages[key].to = target[key] ? 1 : 0;
      stages[key].start = now;
    }
    // Leaving, the page's own stages unwind first, in reverse: on finds the
    // trunk's edge goes back off the right of the screen and the camera rises out of the land; on about the horizon
    // comes back down; on music the scene draws back.
    let out = 0;
    if (page === 'finds') {
      leafy.start = now;
      dived.start = leafy.start + (leafy.from > 0 ? CURTAIN_SECONDS : 0);
      out = dived.start - now + (dived.from > 0 ? DIVE_SECONDS : 0);
    } else if (page === 'about') {
      out = rooted.from > 0 ? ABOUT_SECONDS * 0.8 : 0;
    } else if (page === 'music') {
      musical.start = now + 0.1;
      out = 0.5 * musical.from;
    }
    // Then the forest hides (or comes back), and once it has gone the next
    // page's own stages run.
    bare.start = now + out;
    oSet.from = level(oSet, now, 0.7);
    oSet.to = next === 'finds' ? 1 : 0;
    oSet.start = next === 'finds' ? now : bare.start;
    const entry = now + out + (hides && bare.from < 0.999 ? BARE_LEAD : 0);
    if (next === 'about') rooted.start = entry;
    if (next === 'finds') {
      dived.start = entry;
      leafy.start = entry + DIVE_SECONDS;
    }
    // Music in stages: the f sinks first, the scene draws in once it is
    // on its way, the trees go into the ground and come up as mushrooms in
    // a wave from the middle, and the stump grows once the f has gone.
    // Leaving, the stump sinks as the scene draws back, the trees turn in
    // the same wave and the f grows back last.
    if (next === 'music') musical.start = now + out + 0.2;
    pencilStart = now;
    if (next === 'about') birdsLaunch = now + 0.1;
    // The forest stirs in the direction of travel.
    gust(next === 'music' || page === 'finds' ? 1 : -1);
    const toMusic = next === 'music';
    const fromMusic = page === 'music';
    for (const tree of trees) {
      const snapshot = new Float64Array(tree.n * 2);
      formAt(tree, now, snapshot);
      tree.from = snapshot;
      tree.to = next;
      const d = Math.abs(tree.x - W / 2) / W;
      const jitter = 0.06 * ((tree.seed * 7) % 1);
      let wait = 0;
      let seconds = PAGE_MORPH_SECONDS;
      tree.twoStage = false;
      if (tree.kind === 'mark') {
        if (next === 'music' || next === 'finds') seconds = FINDS_SINK_SECONDS;
        else {
          wait = fromMusic ? 0.45 : out + 0.3;
          seconds = 0.6;
        }
      } else if (tree.kind === 'stump') {
        if (toMusic) {
          wait = out + 0.45;
          seconds = 0.7;
        } else if (fromMusic) seconds = 0.5;
      } else if (toMusic || fromMusic) {
        tree.twoStage = true;
        wait = (toMusic ? out + 0.25 : 0.2) + 0.3 * d;
        seconds = 0.85;
      } else if (hides) {
        seconds = FINDS_SINK_SECONDS;
        wait = 0.15 * d;
      } else {
        // Home again: the trees grow back as the hills do.
        wait = out + 0.1 + 0.15 * d;
      }
      tree.seconds = seconds;
      tree.start = now + wait + jitter;
    }
    page = next;
  };

  const layout = (): ForestLayout => {
    const { x } = markRoot();
    return {
      width: W,
      height: H,
      root: { x, y: groundRest(x) + 0.02 * H },
      groundY: (at: number) => groundRest(at),
    };
  };

  /** Sets the canvas's pixel size; the picture itself does not change. */
  const setPixelRatio = (dpr: number) => {
    dprScale = dpr;
    lastDpr = dpr;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };

  const resize = (w: number, h: number, dpr: number) => {
    // The same size again (a resize observer can fire without a change)
    // must not replant the forest and reset everything in motion.
    if (w === W && h === H) {
      if (dpr !== lastDpr) setPixelRatio(dpr);
      return;
    }
    W = w;
    H = h;
    setPixelRatio(dpr);
    u = Math.max(0.55, Math.min(h / 1024, w / 1440));
    // Fine enough to draw the tufts of the music page's forest floor.
    const step = Math.max(1, 1.6 * u);
    // Ground samples over all three widths; each frame draws the stretch
    // the scene shows.
    const count = Math.ceil((3 * W) / step) + 3;
    groundX = new Float64Array(count);
    for (let i = 0; i < count; i++) groundX[i] = -W - step + i * step;
    buffer = new Float64Array(Math.max(MARK_POINTS, MARK_F.n) * 2);
    slow = new Float64Array(Math.ceil((3 * W) / SLOW_PITCH) + 4);
    slowWind = new Float64Array(slow.length);
    plant();
    const poly = trunkOutline(W, H, FINDS_STRIP, 7);
    // Mirrored to the left of the screen.
    for (let i = 0; i < poly.length; i += 2) poly[i] = W - poly[i];
    trunk = Float64Array.from(poly);
    // The top of the edge is drawn in a little ahead of the bottom.
    trunkLag = new Float64Array(TRUNK_EDGE_POINTS + 1);
    for (let i = 0; i <= TRUNK_EDGE_POINTS; i++) {
      trunkLag[i] = ease(clamp01(trunk[2 * i + 1] / H));
    }
    onLayout?.(layout());
  };

  const setOptions = (next: Partial<ForestOptions>) => {
    Object.assign(opts, next);
    if (W > 0 && H > 0) {
      // Relaid out from scratch: the ground's sampling may change too.
      const w = W;
      W = 0;
      resize(w, H, lastDpr);
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
    const b = stageAt.bare(time);
    const rise = stageAt.rooted(time);
    const m = stageAt.musical(time);
    const dive = stageAt.dived(time);
    const pull = stageAt.leafy(time);
    // The o sets with the f for finds, early on the way out and only as
    // the hills come back on the way home; for music it sinks before the
    // scene draws in. On about the mark stays, riding up and shrinking.
    const oDown = level(oSet, time, 0.7);
    const mk = 1 + (ABOUT_MARK - 1) * ease(rise);
    const markX = markTree ? W / 2 + (markTree.x - W / 2) * mk : W / 2;
    const oDownMusic =
      musical.to > musical.from
        ? ease(clamp01((time - musical.start + 0.2) / 0.6))
        : m;

    // The camera: for music it draws in toward the ground in the middle;
    // for finds it dives into the land about a point under the horizon,
    // evenly in scale, until the screen is all ink; on the way the left of
    // the horizon runs ahead of the right (and, coming back, goes down
    // last). Everything below is drawn in the forest's own coordinates
    // through this.
    const zoom =
      (1 + (MUSIC_ZOOM - 1) * m) * Math.exp(Math.log(DIVE_ZOOM) * ease(dive));
    const lead = DIVE_LEAD * H * Math.sin(Math.PI * ease(dive));
    const px = W / 2;
    const py = groundRest(W / 2) + (m > 0 ? 0 : DIVE_DEPTH * H);
    const e = px - zoom * px;
    const g = py - zoom * py;
    const camera = () =>
      ctx.setTransform(
        dprScale * zoom,
        0,
        0,
        dprScale * zoom,
        dprScale * e,
        dprScale * g,
      );
    camera();
    // Which stretch of the forest the screen shows.
    const x0 = (0 - e) / zoom - 0.1 * W;
    const x1 = (W - e) / zoom + 0.1 * W;
    const deep = H + 2 * Math.max(W, H);
    // The hills swell out of a flat line as the morph begins.
    const intro = time - introStart;
    const swell = ease(clamp01((intro - 0.2) / opts.morphSeconds));
    /** How far the horizon has been drawn up for about at a world x: the left a touch ahead. */
    const risen = (x: number) =>
      rise <= 0
        ? 0
        : ease(
            clamp01(
              rise * (1 + ABOUT_UNEVEN) - ABOUT_UNEVEN * ease(clamp01(x / W)),
            ),
          );
    /** Ground at a world x. */
    const groundAt = (x: number) => {
      const level0 = opts.horizon * H;
      const y = level0 + (groundRest(x) - level0) * swell + breath;
      const ahead =
        lead > 0 ? (lead * (1 - ease(clamp01((e + zoom * x) / W)))) / zoom : 0;
      return y + (ABOUT_HORIZON * H - y) * risen(x) - ahead;
    };

    // The sky of the home page: small clouds drifting along the top. They
    // belong to the forest's own view, so they go with the camera and fade
    // as a section takes over.
    const skyShow = swell * (1 - Math.max(m, b));
    if (skyShow > 0.01 && clouds.length > 0 && opts.cloudTint > 0) {
      ctx.globalAlpha = skyShow;
      for (const cloud of clouds) {
        ctx.fillStyle = cloud.far ? farCloudColour : cloudColour;
        const span = W + 4 * cloud.size;
        const x =
          ((cloud.x0 + opts.cloudSpeed * u * cloud.drift * time) % span) -
          2 * cloud.size;
        for (let k = 0; k < CLOUD_POINTS; k++) {
          buffer[2 * k] = x + cloud.shape[2 * k];
          buffer[2 * k + 1] = cloud.y + cloud.shape[2 * k + 1];
        }
        ctx.beginPath();
        traceSmooth(ctx, buffer, CLOUD_POINTS);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK;
    }

    // The far hills first, behind everything: a faint ridge over the
    // horizon, high at the edges and dipping under the mark, a treeline
    // along it. They fade as the scene draws in for music and as the forest
    // hides.
    const farShow = swell * (1 - m) * (1 - b);
    if (farShow > 0.01 && opts.farTint > 0) {
      ctx.fillStyle = farColour;
      ctx.globalAlpha = farShow;
      ctx.beginPath();
      let first = true;
      let lastX = x0;
      for (let i = 0; i < groundX.length; i++) {
        const x = groundX[i];
        if (x < x0) continue;
        if (x > x1) break;
        const c = (x - W / 2) / (W / 2);
        const valley = 1 - (0.5 + 0.5 * Math.cos(Math.PI * c));
        const rise =
          (opts.farHeight + opts.farDip * valley) * H +
          0.006 * H * Math.sin(5.3 * c + 1.1) +
          farBumps[i];
        const y = opts.horizon * H - rise * swell + breath;
        if (first) {
          ctx.moveTo(x, deep);
          ctx.lineTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
        lastX = x;
      }
      ctx.lineTo(lastX, deep);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK;
    }

    // The skyline is one line, walked left to right: the ground, and at
    // every tree the line climbs its outline, goes over the crown and comes
    // back down to the ground.
    // Table the slow parts over the stretch on show.
    slowX0 = x0 - SLOW_PITCH;
    const slowN = Math.min(
      slow.length,
      Math.ceil((x1 - slowX0) / SLOW_PITCH) + 2,
    );
    for (let i = 0; i < slowN; i++) {
      const x = slowX0 + i * SLOW_PITCH;
      slow[i] = groundAt(x);
      slowWind[i] = windAt(x);
    }
    const slowAt = (table: Float64Array, x: number) => {
      const f = (x - slowX0) / SLOW_PITCH;
      const i = Math.max(0, Math.min(slowN - 2, Math.floor(f)));
      const t = Math.max(0, Math.min(1, f - i));
      return table[i] + (table[i + 1] - table[i]) * t;
    };
    /** The ground at a world x: a clean line, but for the grass of the music page. */
    const floorStep = groundX.length > 1 ? groundX[1] - groundX[0] : 1;
    const groundLine = (x: number) => {
      // Close up on the music page tufts and seedlings stand along the
      // floor, like the far treeline seen near.
      const i = Math.max(
        0,
        Math.min(
          floorBumps.length - 1,
          Math.round((x - groundX[0]) / floorStep),
        ),
      );
      const tuft = (floorBumps[i] ?? 0) * swell;
      return slowAt(slow, x) - tuft * m;
    };
    growMark(time, intro);
    const squash = springMark(time, groundAt(markX), rise > 0 || rooted.to > 0);
    const sx = 1 - squash / 2;
    const sy = 1 + squash;
    let n = 0;
    /** Adds a point to the skyline. */
    const emit = (x: number, y: number) => {
      line[2 * n] = x;
      line[2 * n + 1] = y;
      n++;
    };
    let gi = 0;
    while (gi < groundX.length && groundX[gi] < x0) gi++;
    for (const tree of trees) {
      // Only what the screen shows. On about the mark shrinks toward the
      // middle of the screen, staying centred.
      const mark = tree.kind === 'mark';
      const bx = mark ? markX : tree.x;
      const reach = Math.max(tree.w, 1.2 * tree.h);
      if (bx + reach < x0 || bx - reach > x1) continue;
      // Morph: a flat stretch of the line bulges into a mound, and the
      // mound grows into the tree.
      const p = ease(clamp01((intro - tree.delay) / opts.morphSeconds));
      if (p <= 0) continue;
      const toMound = ease(clamp01(p / 0.35));
      const toTree = ease(clamp01((p - 0.35) / 0.65));
      const rest = groundAt(bx);
      const wind = slowAt(slowWind, bx);
      // A stump stands still; everything else leans with the wind, the
      // mark least, since it is tall.
      const sway =
        tree.kind === 'stump'
          ? 0
          : (tree.kind === 'bush'
              ? 0.02
              : tree.kind === 'mark'
                ? 0.025
                : 0.05) *
            wind *
            tree.h;
      const { mound } = tree;
      const h = mark ? tree.h * mk : tree.h;
      formAt(tree, time, shape);
      // Something that is not there on this page (a flat form) leaves the
      // ground alone: no mound on load, nothing spliced in.
      let tall = 0;
      for (let j = 1; j < tree.n * 2; j += 2) {
        tall = Math.max(tall, Math.abs(shape[j]));
      }
      if (tall < 2e-3) continue;
      for (let j = 0; j < tree.n; j++) {
        const mx = mound[2 * j];
        const my = mound[2 * j + 1] * toMound;
        let lx = mx + (shape[2 * j] - mx) * toTree;
        let ly = my + (shape[2 * j + 1] - my) * toTree;
        if (mark) {
          lx *= sx;
          ly *= sy;
        }
        // Only what stands up sways, and the trunk no more than a tree.
        const up = Math.min(1, Math.max(0, -ly));
        // Where the outline meets the ground it follows the ground line
        // exactly; a little higher up (or deeper down) it is rigid. Only
        // what stands up sways.
        const rigid = ease(clamp01(Math.abs(ly) / 0.15));
        const x = bx + lx * h + sway * up * up;
        buffer[2 * j] = x;
        buffer[2 * j + 1] =
          (rigid >= 1 ? rest : groundLine(x) * (1 - rigid) + rest * rigid) +
          ly * h;
      }
      const left = buffer[0];
      const right = buffer[2 * (tree.n - 1)];
      while (gi < groundX.length && groundX[gi] < left) {
        emit(groundX[gi], groundLine(groundX[gi]));
        gi++;
      }
      while (gi < groundX.length && groundX[gi] <= right) gi++;
      for (let j = 0; j < tree.n; j++) {
        emit(buffer[2 * j], buffer[2 * j + 1]);
      }
    }
    while (gi < groundX.length && groundX[gi] <= x1) {
      emit(groundX[gi], groundLine(groundX[gi]));
      gi++;
    }

    ctx.beginPath();
    if (dive >= 0.999) {
      // Deep in the land the screen is all ink, and its edge is drawn in
      // from the right of the screen to the trunk's edge, the top a
      // little ahead of the bottom; the rest of the trunk's outline is off the left.
      ctx.setTransform(dprScale, 0, 0, dprScale, 0, 0);
      const off = 1.08 * W;
      for (let i = 0; i < trunk.length / 2; i++) {
        let x = trunk[2 * i];
        if (i <= TRUNK_EDGE_POINTS) {
          const k = ease(
            clamp01(pull * (1 + CURTAIN_UNEVEN) - CURTAIN_UNEVEN * trunkLag[i]),
          );
          x = off + (x - off) * k;
        }
        if (i === 0) ctx.moveTo(x, trunk[1]);
        else ctx.lineTo(x, trunk[2 * i + 1]);
      }
      ctx.closePath();
    } else {
      // Through the midpoints with curves, so the line never has a corner,
      // then down and around the bottom of the screen.
      ctx.moveTo(line[0], deep);
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
      ctx.lineTo(line[2 * (n - 1)], deep);
      ctx.closePath();
    }
    ctx.fill();
    camera();

    drawRecordPlayer(time, groundAt);
    // Off the home page the o sinks into the ground: early on the way in,
    // and only once the scene has nearly come home on the way back, so it
    // never pokes out of the stump.
    drawO(
      time,
      intro,
      clamp01((Math.max(oDownMusic, oDown) - 0.18) / 0.32),
      mk,
      groundAt,
      { x: markX, y: groundAt(markX), sx, sy },
    );
    drawPencil(time, n, zoom);
    ctx.setTransform(dprScale, 0, 0, dprScale, 0, 0);
    drawBirds(time, (x: number, y: number) => ({
      x: e + zoom * x,
      y: g + zoom * y,
    }));
    drawFlight(time, skyShow);
  };

  /** One bird, a stroke of two wings at `x, y`, `flap` from −1 (down) to 1 (up). */
  const drawBird = (x: number, y: number, size: number, flap: number) => {
    ctx.beginPath();
    ctx.moveTo(x - size, y - size * 0.5 * flap);
    ctx.quadraticCurveTo(x - size * 0.5, y + size * 0.15 * flap, x, y);
    ctx.quadraticCurveTo(
      x + size * 0.5,
      y + size * 0.15 * flap,
      x + size,
      y - size * 0.5 * flap,
    );
    ctx.stroke();
  };

  /**
   * Now and then a few birds cross the sky of the home page from one side
   * to the other, high up, each on its own gentle wave and beat.
   */
  const drawFlight = (time: number, show: number) => {
    if (opts.birdsCount <= 0 || opts.birdsEvery <= 0) return;
    if (!flight && time >= nextFlight) {
      const rng = mulberry32(Math.floor(time * 7) + opts.seed);
      flight = {
        start: time,
        from: rng() < 0.5 ? 1 : -1,
        y: H * (opts.horizon - opts.birdsAbove - 0.1 * rng()),
        count: 1 + Math.floor(rng() * opts.birdsCount),
        seed: rng() * 100,
      };
    }
    if (!flight) return;
    const speed = opts.birdSpeed * W;
    const age = time - flight.start;
    const across = speed * age;
    if (across > W + 0.3 * W) {
      flight = null;
      nextFlight = time + opts.birdsEvery * (0.6 + 0.8 * noise(time, 17));
      return;
    }
    if (show <= 0.01) return;
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5 * u;
    ctx.globalAlpha = show;
    for (let i = 0; i < flight.count; i++) {
      const lag = i * 0.09 * W;
      const x =
        flight.from > 0 ? -0.1 * W + across - lag : 1.1 * W - across + lag;
      const y =
        flight.y +
        0.025 * H * Math.sin(age * 1.3 + i * 2.1 + flight.seed) +
        i * 0.02 * H;
      const flap = 0.2 + 0.8 * Math.sin(age * 11 + i * 1.7 + flight.seed);
      drawBird(x, y, opts.birdSize * u, flap);
    }
    ctx.globalAlpha = 1;
  };

  /**
   * A few birds take off from the trees by the clearing as the camera draws
   * back for about, and fly up and off over the sky, in screen space so
   * they keep their size while the forest shrinks behind them.
   */
  const drawBirds = (
    time: number,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ) => {
    const flight = time - birdsLaunch;
    if (flight < 0 || flight > BIRDS_SECONDS) return;
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6 * u;
    birdStarts.forEach((start, i) => {
      const age = flight - 0.14 * i;
      if (age <= 0) return;
      const from = toScreen(start.x, start.y);
      const dir = i % 2 === 0 ? -1 : 1;
      const x =
        from.x +
        dir * (0.22 + 0.03 * i) * W * age +
        0.01 * W * Math.sin(age * 3 + i);
      const y =
        from.y -
        (0.1 + 0.02 * i) * H * age -
        0.05 * H * age * age +
        0.008 * H * Math.sin(age * 6 + i * 2);
      // Smaller as they go, like going away.
      const size = 7 * u * Math.max(0.35, 1 - 0.14 * age);
      const flap = 0.2 + 0.8 * Math.sin(age * 13 + i * 1.7);
      drawBird(x, y, size, flap);
    });
  };

  /**
   * A pencil traces the picture whenever the forest changes: on load, once
   * the line has grown, and on every page change. Its tip runs the whole
   * skyline (the f in it) from left to right, then round the o, while the
   * shapes are still morphing, so it passes along the outlines of what was
   * and what will be, wandering off the line; the short trail behind it
   * fades out.
   */
  const drawPencil = (time: number, n: number, zoom: number) => {
    // Into or out of about and finds the forest hides first, and the rising
    // horizon or the dive is the whole event.
    if (bare.to > 0 || bare.from > 0) return;
    // Drawn in the forest's coordinates but the same width on screen
    // whatever the camera does.
    const uz = u / zoom;
    const p = (time - pencilStart) / opts.pencilSeconds;
    if (p <= 0 || p >= 1 + opts.pencilTrail || n < 3) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PENCIL;
    ctx.lineWidth = opts.pencilWidth * uz;
    // Once drawn, the whole line fades out together.
    const end = p < 1 ? 1 : 1 - (p - 1) / opts.pencilTrail;
    /** One stroke of the line, wandering a hand's width off it. */
    const stroke = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      at: number,
      alpha: number,
    ) => {
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / len;
      const ny = (x1 - x0) / len;
      const w =
        opts.pencilWander * uz * noise(at / (opts.pencilWave * uz), time * 0.3);
      ctx.globalAlpha = alpha * end * 0.9;
      ctx.beginPath();
      ctx.moveTo(x0 + nx * w, y0 + ny * w);
      ctx.lineTo(x1 + nx * w, y1 + ny * w);
      ctx.stroke();
    };

    // The skyline, left to right, the tip trailing a short fading tail.
    let total = 0;
    for (let k = 1; k < n; k++) {
      total += Math.hypot(
        line[2 * k] - line[2 * k - 2],
        line[2 * k + 1] - line[2 * k - 1],
      );
    }
    // Nearly even along the line, easing only a touch at the ends: with a
    // full ease the middle flies by at twice the pace.
    const along = clamp01(p / PENCIL_MEET);
    const headSky = total * (0.75 * along + 0.25 * ease(along));
    const trail = total * opts.pencilTrail;
    let s = 0;
    for (let k = 1; k < n; k++) {
      const x0 = line[2 * k - 2];
      const y0 = line[2 * k - 1];
      const x1 = line[2 * k];
      const y1 = line[2 * k + 1];
      const s1 = s + Math.hypot(x1 - x0, y1 - y0);
      if (s1 <= headSky && s1 >= headSky - trail) {
        stroke(
          x0,
          y0,
          x1,
          y1,
          s1,
          ease(clamp01((s1 - (headSky - trail)) / trail)),
        );
      }
      s = s1;
      if (s > headSky) break;
    }

    // Then the o: round it in one go.
    const q = ease(
      clamp01((p - PENCIL_MEET + 0.06) / (1 - PENCIL_MEET + 0.06)),
    );
    if (!markODrawn || q <= 0) {
      ctx.globalAlpha = 1;
      return;
    }
    const m = MARK_O.n;
    let loop = 0;
    for (let k = 1; k <= m; k++) {
      const a = k - 1;
      const b = k % m;
      loop += Math.hypot(
        markO[2 * b] - markO[2 * a],
        markO[2 * b + 1] - markO[2 * a + 1],
      );
    }
    const head = loop * q;
    const tail = head - loop * 0.45;
    s = 0;
    for (let k = 1; k <= m; k++) {
      const a = k - 1;
      const b = k % m;
      const x0 = markO[2 * a];
      const y0 = markO[2 * a + 1];
      const x1 = markO[2 * b];
      const y1 = markO[2 * b + 1];
      const s1 = s + Math.hypot(x1 - x0, y1 - y0);
      if (s1 >= tail && s <= head) {
        stroke(
          x0,
          y0,
          x1,
          y1,
          total + s1,
          ease(clamp01((s1 - tail) / (loop * 0.45))),
        );
      }
      s = s1;
      if (s > head) break;
    }
    ctx.globalAlpha = 1;
  };

  /**
   * The record player, after the back of «Songs from the Wood»: there is no
   * record, the stump's own cut face is the disc. A paper face inside a rim
   * of bark, with growth rings drawn by hand that turn slowly like a record,
   * and a tone arm standing on the far edge of the cut with its head resting
   * on the rings.
   */
  const drawRecordPlayer = (time: number, groundAt: (x: number) => number) => {
    const stump = stumpTree;
    if (!stump) return;
    // The face sits on the stump only once the stump has grown up to it.
    formAt(stump, time, shape);
    let grown = 0;
    for (let j = 1; j < stump.n * 2; j += 2) {
      grown = Math.max(grown, -shape[j]);
    }
    // On load straight onto the music page the stump still grows out of
    // its mound with the rest of the forest: the face waits for that too.
    const intro = ease(
      clamp01((time - introStart - stump.delay) / opts.morphSeconds),
    );
    grown *= ease(clamp01((intro - 0.35) / 0.65));
    const show = ease(clamp01((grown - 0.82) / 0.18));
    if (show <= 0) return;
    const cx = stump.x;
    const h = stump.h * grown;
    const base = groundAt(stump.x);
    const top = stumpTop();
    const rx = top.rx * stump.h;
    const ry = top.ry * stump.h;
    const cy = base + top.cy * h;
    // The face, a rim of bark left around it.
    const fx = rx * 0.91;
    const fy = ry * 0.84;
    const fcy = cy + ry * 0.05;
    ctx.globalAlpha = show;
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.ellipse(cx, fcy, fx, fy, 0, 0, TAU);
    ctx.fill();
    // Growth rings, uneven like a real cut, a little wobbly by hand, and
    // turning slowly: the wobble travels round as the disc spins.
    const spin = time * 0.9;
    const rings = [0.16, 0.27, 0.36, 0.43, 0.52, 0.6, 0.66, 0.74, 0.82, 0.9];
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.8, 0.008 * h);
    for (let i = 0; i < rings.length; i++) {
      const k = rings[i];
      ctx.beginPath();
      const steps = 48;
      for (let q = 0; q <= steps; q++) {
        const a = (q / steps) * TAU;
        const wob =
          1 +
          0.035 *
            noise(Math.cos(a - spin) * 1.4 + i * 3.1, Math.sin(a - spin) * 1.4);
        const x = cx + fx * k * wob * Math.cos(a);
        const y = fcy + fy * k * wob * Math.sin(a);
        if (q === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx, fcy, fx * 0.035, fy * 0.06, 0, 0, TAU);
    ctx.fill();
    // The tone arm: a counterweight and pivot on the far right of the cut,
    // the arm curving forward, the head resting on the rings.
    const px = cx + fx * 0.74;
    const py = fcy - fy * 0.5;
    const post = 0.11 * h;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.045 * h;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - post);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + 0.05 * h, py - post * 1.05, 0.045 * h, 0, TAU);
    ctx.fill();
    // The arm swings in over the rings as the face appears, about its post.
    const hx = cx + fx * 0.2;
    const hy = fcy + fy * 0.42;
    ctx.save();
    ctx.translate(px, py - post);
    ctx.rotate((1 - show) * 0.55);
    ctx.translate(-px, -(py - post));
    ctx.lineWidth = 0.026 * h;
    ctx.beginPath();
    ctx.moveTo(px, py - post);
    ctx.quadraticCurveTo(cx + fx * 0.62, fcy + fy * 0.1, hx, hy - 0.03 * h);
    ctx.stroke();
    ctx.translate(hx, hy - 0.02 * h);
    ctx.rotate(-0.5);
    ctx.fillRect(-0.06 * h, -0.025 * h, 0.12 * h, 0.05 * h);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /**
   * The breathing of the mark's outline: its edges are pushed along the
   * normals by noise travelling around the path, so the line looks alive,
   * like the rings of a tree. In viewBox units, for a mark drawn at `sc`.
   */
  const wobbleOf = (time: number, o: Outline, offset: number, sc: number) => {
    const amp = (markOpts.markWobble * u) / sc;
    const wavelength = 120;
    const spin = time * 0.1;
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

  /** The f's outline cut at the ground, an open path in the making. */
  const cut: number[] = [];

  /**
   * Writes the f's form for this frame into the mark tree: the sprout's
   * outline (it grows out of the ground like a fern, see sprout.ts),
   * breathing, cut off at the ground and walked from the left side of its
   * stem up and round and back down to the right side, in the tree's own
   * units.
   */
  const growMark = (time: number, intro: number) => {
    const tree = markTree;
    if (!tree) return;
    const home = tree.forms.home;
    const about = tree.forms.about;
    const flat = () => {
      for (let k = 0; k < MARK_POINTS * 2; k++) {
        home[k] = markFlat[k];
        about[k] = markFlat[k];
      }
    };
    const progress = (intro - SPROUT_DELAY) / markOpts.sproutSeconds;
    if (progress <= 0) {
      flat();
      return;
    }
    const pose = sproutPose(F_SPINE, progress, markOpts.coil);
    const sc = tree.h / LOGO_VIEWBOX.h;
    sproutOutline(
      F_SPINE,
      F_BOUND,
      pose,
      wobbleOf(time, MARK_F, 7, sc),
      fBuffer,
    );
    // Where the outline crosses the ground, walking round it.
    const N = MARK_F.n;
    const yc = F_CUT.y;
    const crossK: number[] = [];
    const crossX: number[] = [];
    for (let j = 0; j < N; j++) {
      const k = (j + 1) % N;
      const y0 = fBuffer[2 * j + 1];
      const y1 = fBuffer[2 * k + 1];
      if (y0 < yc !== y1 < yc) {
        const t = (yc - y0) / (y1 - y0);
        crossK.push(j);
        crossX.push(fBuffer[2 * j] + (fBuffer[2 * k] - fBuffer[2 * j]) * t);
      }
    }
    if (crossK.length < 2) {
      flat();
      return;
    }
    // The longest arc above the ground between two crossings is the f.
    let best = -1;
    let bestLen = 0;
    for (let c = 0; c < crossK.length; c++) {
      const a = crossK[c];
      const b = crossK[(c + 1) % crossK.length];
      if (fBuffer[2 * ((a + 1) % N) + 1] >= yc) continue;
      const len = (b - a + N) % N;
      if (len > bestLen) {
        bestLen = len;
        best = c;
      }
    }
    if (best < 0) {
      flat();
      return;
    }
    const a = crossK[best];
    const b = crossK[(best + 1) % crossK.length];
    cut.length = 0;
    cut.push(crossX[best], yc);
    for (let j = (a + 1) % N; j !== (b + 1) % N; j = (j + 1) % N) {
      cut.push(fBuffer[2 * j], fBuffer[2 * j + 1]);
    }
    cut.push(crossX[(best + 1) % crossK.length], yc);
    // Left foot first.
    if (cut[0] > cut[cut.length - 2]) {
      const rev: number[] = [];
      for (let j = cut.length - 2; j >= 0; j -= 2) rev.push(cut[j], cut[j + 1]);
      cut.length = 0;
      cut.push(...rev);
    }
    const even = resampleOpen(cut, MARK_POINTS);
    const vb = LOGO_VIEWBOX.h;
    for (let j = 0; j < MARK_POINTS; j++) {
      const x = (even[2 * j] - F_CUT.x) / vb;
      const y = (even[2 * j + 1] - yc) / vb;
      home[2 * j] = x;
      home[2 * j + 1] = y;
      about[2 * j] = x;
      about[2 * j + 1] = y;
    }
  };

  /**
   * The o of the mark, in the same ink: it rises from behind the horizon
   * once the f has grown and floats beside it, bobbing and breathing on its
   * own; it sets again for music and finds, and on about rides up into the
   * strip of sky with the f, shrinking.
   */
  const drawO = (
    time: number,
    intro: number,
    /** How far the o has sunk back into the ground, 0..1. */
    away: number,
    /** The mark's scale, about the middle of the screen. */
    mk: number,
    groundAt: (x: number) => number,
    /** The squash or stretch the f has, about its foot, for the o to share. */
    squash: { x: number; y: number; sx: number; sy: number },
  ) => {
    markODrawn = false;
    if (away >= 0.999) return;
    const keep = 1 - away;
    const root = markRoot();
    const rootX = W / 2 + (root.x - W / 2) * mk;
    const sc = (root.logoH * mk) / LOGO_VIEWBOX.h;
    const rootY = groundAt(rootX) + 0.02 * H * mk;
    const progress = (intro - SPROUT_DELAY) / markOpts.sproutSeconds;
    if (progress <= 0) return;
    // The o rises once; as the mark withdraws it sinks back behind the
    // horizon at full strength, into the ground, instead of fading away.
    const risen = ease(
      clamp01(
        ((progress - O_RISE_AT) * markOpts.sproutSeconds) / O_RISE_SECONDS,
      ),
    );
    const rise = keep * risen;
    if (rise <= 0) return;
    const bob = 3 * Math.sin((time / 9) * TAU);
    const lift = markOpts.oLift * rise - 150 * (1 - rise) + bob;
    const shift = markOpts.oShift * rise;
    const oScale =
      markOpts.oScale *
      (1 + 0.02 * Math.sin((time / markOpts.markBreath) * TAU + 1.3));
    const oWobble = wobbleOf(time, MARK_O, 23, sc);
    ctx.fillStyle = INK;
    // Solid ink the whole way: it comes up from behind the hill like a
    // sun, never as a pale disc through the far hills.
    ctx.globalAlpha = 1;
    for (let j = 0; j < MARK_O.n; j++) {
      const d = oWobble(j);
      const x = MARK_O.x[j] + MARK_O.nx[j] * d;
      const y = MARK_O.y[j] + MARK_O.ny[j] * d;
      const vx = oCentre.x + (x - oCentre.x) * oScale + shift;
      const vy = oCentre.y + (y - oCentre.y) * oScale - lift;
      const ox = rootX + (vx - LOGO_ROOT.x) * sc;
      const oy = rootY + (vy - LOGO_ROOT.y) * sc;
      markO[2 * j] = squash.x + (ox - squash.x) * squash.sx;
      markO[2 * j + 1] = squash.y + (oy - squash.y) * squash.sy;
    }
    markODrawn = true;
    ctx.beginPath();
    traceSmooth(ctx, markO, MARK_O.n);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  /**
   * Steps the mark's spring to `time`, driven by how its foot on the ground
   * at `footY` speeds up and slows down (only while `driven`), and returns
   * its squash (−) or stretch (+). Small fixed steps keep it steady at any
   * frame rate.
   */
  const springMark = (time: number, footY: number, driven: boolean) => {
    const sp = markSpring;
    const dt = time - sp.at;
    if (sp.at < 0 || dt <= 0 || dt > 0.1) {
      sp.at = time;
      sp.y = footY;
      sp.vy = 0;
      return sp.s;
    }
    const vy = (footY - sp.y) / dt;
    // The ground's pull on the mark's top, in its heights per s²: up the
    // screen is −, and a top that lags behind a rising foot is squashed.
    const pull = driven
      ? (MARK_SPRING_GAIN * (vy - sp.vy)) / dt / (markTree?.h || H)
      : 0;
    sp.y = footY;
    sp.vy = vy;
    sp.at = time;
    const w = TAU * MARK_SPRING_HZ;
    const steps = Math.ceil(dt / (1 / 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      sp.v += (pull - w * w * sp.s - 2 * MARK_SPRING_DAMPING * w * sp.v) * h;
      sp.s += sp.v * h;
    }
    sp.s = Math.max(-MARK_SPRING_MAX, Math.min(MARK_SPRING_MAX, sp.s));
    return sp.s;
  };

  const gust = (direction: 1 | -1) => {
    if (gustStart >= 0 && lastTime - gustStart < opts.gustSeconds * 0.5) return;
    gustStart = lastTime;
    gustDir = direction;
    nextGust = lastTime + opts.gustEvery;
  };

  const restart = () => {
    introStart = lastTime;
    pencilStart = lastTime + opts.morphSeconds + opts.morphStagger * 0.5;
  };

  return {
    resize,
    setPixelRatio,
    draw,
    setOptions,
    setMark,
    restart,
    setPage,
    gust,
    windAt,
    layout,
  };
};
