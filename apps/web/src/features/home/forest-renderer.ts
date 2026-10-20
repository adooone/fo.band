import { createNoise2D } from 'simplex-noise';
import { clamp01, ease } from './easing';
import {
  flatShape,
  leafShape,
  mushroomShape,
  STUMP,
  stumpShape,
  stumpTop,
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
 * middle under the mark, with a ripple of grass that moves with the wind,
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
/** Where the ground rises to on the about page, fraction of the height. */
const ABOUT_HORIZON = 0.17;
/** How small the mark gets in the strip of sky on the about page. */
const ABOUT_MARK = 0.34;
/** How much the trees shrink on the about page. */
const ABOUT_TREE = 0.55;
/** How close the music page draws in to the forest floor. */
const MUSIC_ZOOM = 2.1;
/** On the finds page the land turns into a tree trunk on the right this wide (of the width). */
export const FINDS_STRIP = 1 / 6;
/** The whole skyline flows into the trunk over this long, once the trees and the f have sunk. */
const FINDS_SECONDS = 1.1;
const FINDS_WAIT = 0.4;
/**
 * The pencil that traces the skyline on every change: how long it takes to
 * cross the line, how long its trail is (of the line), and how far it
 * wanders off the silhouette (in u) over how long a wave (in u).
 */
const PENCIL_SECONDS = 4;
const PENCIL_TRAIL = 0.12;
const PENCIL_WANDER = 10;
const PENCIL_WAVE = 170;
/**
 * Page changes are quick and organic: the scene draws in or turns, and
 * every point of every outline starts on its own beat (tops and tips
 * first). Every curve eases in and out with no overshoot. Nothing slides:
 * every page is the same forest in another pose.
 */
const SCENE_SECONDS = 0.95;
const ABOUT_SECONDS = 0.85;
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
  /** How long the morph from the flat line takes, per tree. */
  morphSeconds: number;
  /** Extra delay for the trees at the edges, seconds. */
  morphStagger: number;
  /** Seed for the forest, so it is the same forest on every visit. */
  seed: number;
};

export const DEFAULT_OPTIONS: ForestOptions = {
  horizon: 0.8,
  hill: 0.055,
  waves: 0.005,
  waveCount: 7.1,
  treeMax: 0.14,
  treeMin: 0.23,
  gap: 0.15,
  clearing: 0,
  spruces: 0.4,
  oaks: 0.4,
  bushes: 0,
  trunk: 0.16,
  grassAmp: 2.4,
  grassWavelength: 10,
  grassSpeed: 0,
  wind: 3,
  gustEvery: 8,
  gustSeconds: 8.8,
  breathSeconds: 12,
  morphSeconds: 1.5,
  morphStagger: 2,
  seed: 9,
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

/** A form shrunk about its foot. */
const scaled = (form: number[], by: number): number[] =>
  form.map((v) => v * by);

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
  oScale: 0.78,
  markWobble: 1.2,
  markBreath: 6,
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
  /** The whole skyline for one frame: ground, grass and trees as one line. */
  let line = new Float64Array(0);
  /** The tree the land turns into on the finds page, and arc length along it. */
  let trunk = new Float64Array(0);
  let trunkS = new Float64Array(0);
  let W = 0;
  let H = 0;
  let dprScale = 1;
  let lastDpr = 1;
  /** One design pixel in CSS px (1 at 1024 tall), floored for phones. */
  let u = 1;
  let groundX = new Float64Array(0);
  /**
   * The slowly varying part of the ground (hills and breath)
   * and the wind, tabled once a frame at a coarse pitch and read back by
   * interpolation: they change over tens of pixels, the grass over a few.
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
  /** How far into the roots, music and finds pages the scene is: animated. */
  const rooted = { from: 0, to: 0, start: -1e9 };
  const musical = { from: 0, to: 0, start: -1e9 };
  const leafy = { from: 0, to: 0, start: -1e9 };
  /** When the pencil last set off: on a page change, or once the intro has grown. */
  let pencilStart = opts.morphSeconds + opts.morphStagger * 0.5;
  const level = (
    v: { from: number; to: number; start: number },
    t: number,
    seconds: number,
    curve: (p: number) => number = ease,
  ) => v.from + (v.to - v.from) * curve(clamp01((t - v.start) / seconds));

  /**
   * The resting ground line at a world x: hills highest in the middle of
   * every page, with smaller waves. On the about page (`r` → 1) it rises
   * high and flattens out.
   */
  const groundRest = (x: number, r = 0, flat = r): number => {
    const c = (x - W / 2) / (W / 2);
    const hill = opts.hill * H * (0.5 + 0.5 * Math.cos(Math.PI * c));
    const wave = opts.waves * H * Math.sin(Math.PI * opts.waveCount * c + 0.7);
    const horizon = opts.horizon + (ABOUT_HORIZON - opts.horizon) * r;
    return horizon * H - (hill + wave) * (1 - 0.8 * flat);
  };

  /** Where the f's root is (its x and the mark's height) at a roots level. */
  const markRoot = (r: number) => {
    const logoH = logoHeight(W, H, markOpts.logo) * (1 + (ABOUT_MARK - 1) * r);
    const rootOffset =
      ((LOGO_VIEWBOX.w + markOpts.oShift) / 2 -
        (LOGO_ROOT.x - LOGO_VIEWBOX.x)) /
      LOGO_VIEWBOX.h;
    return { x: W / 2 - rootOffset * logoH, logoH };
  };
  /** Where the f's stem meets the ground (CSS px) at a roots level. */
  const markFoot = (r: number) => {
    const { x, logoH } = markRoot(r);
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
        const meanW = (prevW + w) / 2 || w;
        x +=
          side * (prevW / 2 + opts.gap * meanW * (0.6 + 0.8 * rng()) + w / 2);
        prevW = w;
        const seed = rng() * 100;
        const tree =
          kind === 'oak'
            ? leafShape(seed, 1, 'oak', opts.trunk)
            : treeShape(kind, w / h, seed, opts.trunk, blobNoise);
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
            music: mushroomShape(seed, 0.38 + 0.18 * rng()),
            // Sunk with the ground.
            finds: flatShape(w / h),
            // Smaller, on a few roots of its own.
            // Smaller, under the thin strip of sky.
            about: scaled(tree, ABOUT_TREE),
          },
        );
      }
    };
    place(1, 2 * W + 0.1 * S);
    place(-1, -W - 0.1 * S);
    // The f of the mark, in the line like a tree: it sprouts, so its form
    // on the home and about pages is written every frame (`growMark`);
    // on the music and finds pages it sinks back into the ground. Never a
    // mound: the sprout is its own intro.
    const foot = markFoot(0);
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
    markTree = trees.find((t) => t.kind === 'mark') ?? null;
    stumpTree = trees.find((t) => t.kind === 'stump') ?? null;
    const points = trees.reduce((sum, t) => sum + t.n, 0);
    line = new Float64Array((groundX.length + points + 4) * 2);
  };

  const setPage = (next: PageId, instant = false) => {
    const now = lastTime;
    const levels = {
      rooted: 'about',
      musical: 'music',
      leafy: 'finds',
    } as const;
    const all = { rooted, musical, leafy };
    if (instant) {
      page = next;
      for (const key of Object.keys(levels) as (keyof typeof levels)[]) {
        all[key].from = all[key].to = next === levels[key] ? 1 : 0;
      }
      for (const tree of trees) {
        tree.from = Float64Array.from(tree.forms[next]);
        tree.to = next;
        tree.start = -1e9;
      }
      return;
    }
    if (next === page) return;
    rooted.from = level(rooted, now, ABOUT_SECONDS);
    musical.from = level(musical, now, SCENE_SECONDS);
    leafy.from = level(leafy, now, FINDS_SECONDS);
    for (const key of Object.keys(levels) as (keyof typeof levels)[]) {
      all[key].to = next === levels[key] ? 1 : 0;
      all[key].start = now;
    }
    // The land flows into the trunk only once the trees and the f have
    // sunk into it, so the line has no loops left to tangle.
    if (next === 'finds') leafy.start = now + FINDS_WAIT;
    pencilStart = now;
    // Trees take their new forms in a quick wave from the middle: sinking
    // fast on the way to finds, growing back once the land has come home.
    for (const tree of trees) {
      const snapshot = new Float64Array(tree.n * 2);
      formAt(tree, now, snapshot);
      tree.from = snapshot;
      tree.to = next;
      tree.seconds = next === 'finds' ? FINDS_WAIT + 0.15 : PAGE_MORPH_SECONDS;
      const d = Math.abs(tree.x - W / 2) / W;
      // The stump waits a moment for the f to sink.
      const wait =
        tree.kind === 'stump' && next === 'music'
          ? 0.28
          : page === 'finds'
            ? FINDS_SECONDS * 0.7
            : 0;
      tree.start = now + wait + 0.22 * d + 0.06 * ((tree.seed * 7) % 1);
    }
    page = next;
  };

  const layout = (): ForestLayout => {
    const { x } = markRoot(0);
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
    if (w === W && h === H && dpr !== lastDpr) {
      setPixelRatio(dpr);
      return;
    }
    W = w;
    H = h;
    setPixelRatio(dpr);
    u = Math.max(0.55, Math.min(h / 1024, w / 1440));
    // Fine enough to draw the grass ripple as a smooth wave.
    const step = Math.min(
      Math.max(2, 3 * u),
      Math.max(1, (opts.grassWavelength * u) / 6),
    );
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
    trunk = Float64Array.from(poly);
    trunkS = new Float64Array(poly.length / 2);
    for (let i = 1; i < trunkS.length; i++) {
      trunkS[i] =
        trunkS[i - 1] +
        Math.hypot(
          poly[2 * i] - poly[2 * i - 2],
          poly[2 * i + 1] - poly[2 * i - 1],
        );
    }
    onLayout?.(layout());
  };

  /** The point this far (0..1) along the trunk's outline. */
  const trunkAt = (t: number, out: Float64Array, at: number) => {
    const target = t * trunkS[trunkS.length - 1];
    let lo = 0;
    let hi = trunkS.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (trunkS[mid] <= target) lo = mid;
      else hi = mid;
    }
    const span = trunkS[hi] - trunkS[lo] || 1;
    const k = Math.min(1, Math.max(0, (target - trunkS[lo]) / span));
    out[at] = trunk[2 * lo] + (trunk[2 * hi] - trunk[2 * lo]) * k;
    out[at + 1] =
      trunk[2 * lo + 1] + (trunk[2 * hi + 1] - trunk[2 * lo + 1]) * k;
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
    const r = level(rooted, time, ABOUT_SECONDS);
    const m = level(musical, time, SCENE_SECONDS);
    // How far the land has flowed into the trunk for the finds page.
    const f = level(leafy, time, FINDS_SECONDS);
    // The o sinks with the f, before the land lifts.
    const oDown =
      leafy.to > leafy.from
        ? ease(clamp01((time - leafy.start + FINDS_WAIT) / 0.7))
        : f;
    const flat = Math.max(r, f);

    // The scene's pose for music: drawn in toward the ground in the middle.
    // Everything below is drawn in the forest's own coordinates through this.
    const zoom = 1 + (MUSIC_ZOOM - 1) * m;
    const px = W / 2;
    const py = groundRest(W / 2, r, flat);
    const e = px - zoom * px;
    const g = py - zoom * py;
    ctx.setTransform(
      dprScale * zoom,
      0,
      0,
      dprScale * zoom,
      dprScale * e,
      dprScale * g,
    );
    // Which stretch of the forest the screen shows.
    const x0 = (0 - e) / zoom - 0.1 * W;
    const x1 = (W - e) / zoom + 0.1 * W;
    const deep = H + 2 * Math.max(W, H);
    // The hills swell out of a flat line as the morph begins.
    const intro = time - introStart;
    const swell = ease(clamp01((intro - 0.2) / opts.morphSeconds));
    /** Ground at a world x. */
    const groundAt = (x: number) => {
      const level0 = (opts.horizon + (ABOUT_HORIZON - opts.horizon) * r) * H;
      return level0 + (groundRest(x, r, flat) - level0) * swell + breath;
    };

    // The skyline is one line, walked left to right: the ground with the
    // grass ripple riding on it, and at every tree the line climbs its
    // outline, goes over the crown and comes back down to the ground. The
    // ripple travels with the wind and grows where the wind blows harder.
    const lambda = opts.grassWavelength * u;
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
    const grassK = opts.grassAmp * u * swell;
    const grassT = time * opts.grassSpeed * TAU;
    /** The ground with its grass at a world x. */
    const groundLine = (x: number) => {
      const wind = slowAt(slowWind, x);
      const phase = (x / lambda) * TAU - grassT * (0.6 + wind);
      const grass =
        grassK * (0.7 + 0.6 * Math.abs(wind)) * (0.5 + 0.5 * Math.sin(phase));
      return slowAt(slow, x) - grass;
    };
    growMark(time, intro);
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
      // Only what the screen shows.
      const bx = tree.x;
      const reach = Math.max(tree.w, 1.2 * tree.h);
      if (bx + reach < x0 || bx - reach > x1) continue;
      // Morph: a flat stretch of the line bulges into a mound, and the
      // mound grows into the tree.
      const p = ease(clamp01((intro - tree.delay) / opts.morphSeconds));
      if (p <= 0) continue;
      const toMound = ease(clamp01(p / 0.35));
      const toTree = ease(clamp01((p - 0.35) / 0.65));
      const rest = groundAt(tree.x);
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
      const { mound, h } = tree;
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
        const lx = mx + (shape[2 * j] - mx) * toTree;
        const ly = my + (shape[2 * j + 1] - my) * toTree;
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

    // Through the midpoints with curves, so the line never has a corner,
    // then down and around the bottom of the screen.
    if (f > 0) {
      // The finds page: the whole line flows into the tree, each point to
      // the place as far along the trunk's outline as it was along the
      // land, so the land lifts into the trunk and the branch as one.
      const span = x1 - x0 || 1;
      for (let k = 0; k < n; k++) {
        const t = clamp01((line[2 * k] - x0) / span);
        trunkAt(t, buffer, 0);
        line[2 * k] += (buffer[0] - line[2 * k]) * f;
        line[2 * k + 1] += (buffer[1] - line[2 * k + 1]) * f;
      }
    }
    ctx.beginPath();
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
    ctx.fill();

    drawRecordPlayer(time, groundAt);
    // On the music and finds pages the o sinks into the ground: early on
    // the way in, and only once the scene has nearly come home on the way
    // back, so it never pokes out of the stump or the strip.
    drawO(
      time,
      intro,
      r,
      clamp01((Math.max(m, oDown) - 0.18) / 0.32),
      groundAt,
    );
    drawPencil(time, n);
    ctx.setTransform(dprScale, 0, 0, dprScale, 0, 0);
  };

  /**
   * A pencil traces the picture whenever the forest changes: on load, once
   * the line has grown, and on every page change. Its tip runs the whole
   * skyline (the f in it) from left to right, then round the o, while the
   * shapes are still morphing, so it passes along the outlines of what was
   * and what will be, wandering off the line; the short trail behind it
   * fades out.
   */
  const drawPencil = (time: number, n: number) => {
    const p = (time - pencilStart) / PENCIL_SECONDS;
    if (p <= 0 || p >= 1 + PENCIL_TRAIL || n < 3) return;
    // The strokes in order; the mark's outlines are closed loops.
    const pieces: { buf: Float64Array; n: number; closed: boolean }[] = [
      { buf: line, n, closed: false },
    ];
    if (markODrawn) pieces.push({ buf: markO, n: MARK_O.n, closed: true });
    const segment = (piece: (typeof pieces)[number], k: number) => {
      const a = k - 1;
      const b = k % piece.n;
      return [
        piece.buf[2 * a],
        piece.buf[2 * a + 1],
        piece.buf[2 * b],
        piece.buf[2 * b + 1],
      ] as const;
    };
    const count = (piece: (typeof pieces)[number]) =>
      piece.closed ? piece.n + 1 : piece.n;
    // Arc length along everything, to place the tip by distance, not points.
    let total = 0;
    for (const piece of pieces) {
      for (let k = 1; k < count(piece); k++) {
        const [x0, y0, x1, y1] = segment(piece, k);
        total += Math.hypot(x1 - x0, y1 - y0);
      }
    }
    const head = total * ease(clamp01(p));
    const tail = head - total * PENCIL_TRAIL;
    const trail = total * PENCIL_TRAIL;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PENCIL;
    ctx.lineWidth = 1.8 * u;
    let s = 0;
    for (const piece of pieces) {
      for (let k = 1; k < count(piece); k++) {
        const [x0, y0, x1, y1] = segment(piece, k);
        const len = Math.hypot(x1 - x0, y1 - y0);
        const s1 = s + len;
        if (s1 >= tail && s <= head) {
          // Fades from the tip back along the trail.
          const fade = ease(clamp01((s1 - tail) / trail));
          const alpha = fade * (p < 1 ? 1 : 1 - (p - 1) / PENCIL_TRAIL);
          // A hand's wander, perpendicular to the line.
          const nx = -(y1 - y0) / (len || 1);
          const ny = (x1 - x0) / (len || 1);
          const w =
            PENCIL_WANDER * u * noise(s1 / (PENCIL_WAVE * u), time * 0.3);
          ctx.globalAlpha = alpha * 0.9;
          ctx.beginPath();
          ctx.moveTo(x0 + nx * w, y0 + ny * w);
          ctx.lineTo(x1 + nx * w, y1 + ny * w);
          ctx.stroke();
        }
        s = s1;
        if (s > head) break;
      }
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
    const hx = cx + fx * 0.2;
    const hy = fcy + fy * 0.42;
    ctx.lineWidth = 0.026 * h;
    ctx.beginPath();
    ctx.moveTo(px, py - post);
    ctx.quadraticCurveTo(cx + fx * 0.62, fcy + fy * 0.1, hx, hy - 0.03 * h);
    ctx.stroke();
    ctx.save();
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
   * units. The about page gets the same form shrunk into the strip of sky
   * and shifted to stay beside the o.
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
    const shift = (markFoot(1).x - tree.x) / tree.h;
    for (let j = 0; j < MARK_POINTS; j++) {
      const x = (even[2 * j] - F_CUT.x) / vb;
      const y = (even[2 * j + 1] - yc) / vb;
      home[2 * j] = x;
      home[2 * j + 1] = y;
      about[2 * j] = x * ABOUT_MARK + shift;
      about[2 * j + 1] = y * ABOUT_MARK;
    }
  };

  /**
   * The o of the mark, in the same ink: it rises from behind the horizon
   * once the f has grown and floats beside it, bobbing and breathing on its
   * own; on the about page it shrinks with the f into the strip of sky.
   */
  const drawO = (
    time: number,
    intro: number,
    r: number,
    /** How far the o has sunk back into the ground, 0..1. */
    away: number,
    groundAt: (x: number) => number,
  ) => {
    markODrawn = false;
    if (away >= 0.999) return;
    const keep = 1 - away;
    const { x: rootX, logoH } = markRoot(r);
    const sc = logoH / LOGO_VIEWBOX.h;
    const rootY = groundAt(rootX) + 0.02 * H * (1 - 0.5 * r);
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
    ctx.globalAlpha = 0.1 + 0.9 * risen;
    for (let j = 0; j < MARK_O.n; j++) {
      const d = oWobble(j);
      const x = MARK_O.x[j] + MARK_O.nx[j] * d;
      const y = MARK_O.y[j] + MARK_O.ny[j] * d;
      const vx = oCentre.x + (x - oCentre.x) * oScale + shift;
      const vy = oCentre.y + (y - oCentre.y) * oScale - lift;
      markO[2 * j] = rootX + (vx - LOGO_ROOT.x) * sc;
      markO[2 * j + 1] = rootY + (vy - LOGO_ROOT.y) * sc;
    }
    markODrawn = true;
    ctx.beginPath();
    traceSmooth(ctx, markO, MARK_O.n);
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
