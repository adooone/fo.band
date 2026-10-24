import { createNoise2D } from 'simplex-noise';
import { anticipate, clamp01, ease, swell as swellPast } from './easing';
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
import { type InstrumentKind, type Shape, shapeOf } from './instruments';
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
 * The about page: the forest sinks into the ground first (this long, the
 * next stage starting this long after it began), then the camera draws
 * back: the horizon is drawn up until it is this far down the screen, a
 * thin strip of sky over the land, the left half a little ahead of the
 * right; the mark rides up on it in the middle, shrinking to this scale.
 * The move eases in and out, no give; coming home the land comes down the
 * same way and the forest grows back.
 */
const ABOUT_HIDE_SECONDS = 0.3;
const ABOUT_LEAD = 0.2;
const ABOUT_HORIZON = 0.12;
const ABOUT_SECONDS = 0.6;
/** Share of the rise by which the right edge trails the left. */
const ABOUT_UNEVEN = 0.25;
const ABOUT_MARK = 0.22;
/**
 * How far things run past their size as they grow (the `c` of `swell`: a
 * slow swell from halfway on, back over the last third, never a twitch):
 * trees, the stump and the f about 2% of their height, the mushrooms
 * about 4%; and how far they draw up before they sink (the `c1` of
 * `anticipate`), about 2%.
 */
const GROW_SWELL = 1.8;
const MUSHROOM_SWELL = 2;
const SINK_DRAW = 0.7;
/** How deep the instruments' feet sit in the ground, of their height. */
const INSTRUMENT_SINK = 0.07;
/**
 * The keys sit deeper: the stool's legs end higher than the keyboard's (as
 * drawn in Figma), so it would hang over the grass otherwise.
 */
const KEYS_SINK = 0.12;
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
/**
 * How far the home page shifts with the pointer at the screen's edge, in
 * u: the near clouds, the far clouds, the far hills and the land (the
 * forest and the mark on it), each the other way from the pointer, nearer
 * ones more; and how long the look takes to follow (seconds, exponential).
 */
const LOOK_CLOUDS = 64;
const LOOK_FAR_CLOUDS = 32;
const LOOK_HILLS = 20;
const LOOK_LAND = 8;
const LOOK_SECONDS = 0.4;
/**
 * The o sets quickly (this long) as the f sinks for music or the dive
 * starts for art, and comes back up from behind the hill slowly, like a
 * sun, over this long.
 */
const O_SET_SECONDS = 0.7;
const O_RISE_BACK_SECONDS = 1.8;
/** How close the music page draws in to the forest floor. */
const MUSIC_ZOOM = 2.1;
/**
 * On the finds page the land turns into a tree trunk this wide (of the
 * width), on the left of the screen: the trunk is built for the right
 * and mirrored.
 */
export const FINDS_STRIP = 1 / 6;
/**
 * The finds page in stages: the camera draws back a breath, then dives
 * into the land, the forest and the mark growing past it, about a point
 * this far (of the height) under the horizon, until the screen is all
 * ink; then the ink's edge is drawn in from the right of the screen into
 * the trunk's edge, the top a little ahead of the bottom. The way back
 * unwinds in the same order.
 */
const MUSIC_SINK_SECONDS = 0.45;
const DIVE_SECONDS = 0.8;
const DIVE_DEPTH = 0.08;
const DIVE_ZOOM = 14;
/**
 * Halfway through the dive the left of the horizon is ahead of the right
 * by this much of the height (on screen), the line bending smoothly
 * between them; the gap closes as the screen fills.
 */
const DIVE_LEAD = 0.4;
const CURTAIN_SECONDS = 0.4;
/** Narrower than this (CSS px, Tailwind's `sm`), the art page stays all ink. */
const PHONE_WIDTH = 640;
/** Share of the pull by which the bottom of the edge trails the top. */
const CURTAIN_UNEVEN = 0.25;
/**
 * The opening, while the page loads: a blank sheet; after a beat the pencil
 * draws the skyline, hills and trees, from left to right, and meanwhile the
 * land is poured in from below the screen like water into a glass, sloshing
 * side to side until it settles into the hills. Once all is drawn the
 * trees grow into the drawing from the middle outward as the pencil's line
 * fades, and the clouds swell slowly one by one; the f sprouts and the o
 * rises; last, with the text, the far hills rise behind the land.
 */
const DRAW_WAIT = 0.3;
const DRAW_SECONDS = 2.4;
/** The land arrives at the hills this long after the pencil has finished. */
const RISE_SETTLE = 0.5;
/**
 * The land fills the screen like water poured into a glass: its surface
 * sloshes side to side as it rises (one side higher, then the other), with
 * a quicker ripple on top, and settles into the hills as it arrives, never
 * running over them. How high the slosh and the ripple reach at their most
 * (of the height), and how fast they swing (Hz).
 */
const SLOSH = 0.09;
const SLOSH_HZ = 0.55;
const RIPPLE = 0.025;
const RIPPLE_HZ = 1.15;
const DRAW_TOTAL = DRAW_WAIT + DRAW_SECONDS + RISE_SETTLE;
/**
 * The pencil's drawing holds this long after the land has risen, then fades
 * over the next while, as the trees grow into it.
 */
const OPENING_HOLD = 0.8;
const OPENING_FADE = 2.6;
/** How long the clouds take to swell, one after another, once all is drawn. */
const CLOUD_SECONDS = 3.5;
/** How long the far hills take to rise, with the text. */
const DAWN_SECONDS = 1.6;
/**
 * Page changes are quick and organic: the scene draws in or turns, and
 * every point of every outline starts on its own beat (tops and tips
 * first). Whatever grows runs a little past its height and settles;
 * whatever sinks draws up first. Nothing slides: every page is the same
 * forest in another pose.
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
  /** Seed for the forest: the trees, their places and their mushrooms (the shell draws a new one on every visit). */
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
   * The pencil that draws the skyline in the opening: how far it wanders
   * off the silhouette (in u) over how long a wave (in u), and how thick it
   * draws (in u).
   */
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
  /**
   * How much the home page follows the pointer: the sky layers and the
   * land shift a little the other way, nearer ones more, like looking
   * past them. 0 is none, 1 the whole of it.
   */
  parallax: number;
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
  parallax: 1,
};

/** Raised-cosine bump, 1 at the centre and 0 beyond ±1. */
export const bump = (u: number): number =>
  u <= -1 || u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * u);

/**
 * Points per tree outline; the mound has the same count, so they can morph.
 * Trees are a few dozen px tall: 64 draws them as well as 96 did, with a
 * third less path for the browser to fill every frame.
 */
export const POINTS = 64;
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
  /** Changes the ink, a `#rrggbb` colour; every tint follows it. */
  setInk: (ink: string) => void;
  /** Plays the intro again: the forest morphs out of the line, the f sprouts. */
  restart: () => void;
  /** Goes to a page: the scene takes its pose and the forest its forms. */
  setPage: (page: PageId, instant?: boolean) => void;
  /** Sends a gust across the forest from the left (+1) or the right (−1). */
  gust: (direction: 1 | -1) => void;
  /** Wind strength at a screen x right now, about −1..1 (positive blows right). */
  windAt: (x: number) => number;
  /** Where the pointer is, −1..1 from the middle of the screen each way; the home page looks past the forest with it. */
  setPointer: (x: number, y: number) => void;
  layout: () => ForestLayout;
};

export const INK = '#000000';
export const PAPER = '#f7f6f1';
/** Paper with this much of the ink `base` in it, as a CSS colour. */
const tinted = (share: number, base: string): string => {
  const mix = (at: number) => {
    const a = Number.parseInt(PAPER.slice(at, at + 2), 16);
    const b = Number.parseInt(base.slice(at, at + 2), 16);
    return Math.round(a + (b - a) * share)
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

/**
 * When the text of the home page may show, seconds after the opening
 * began: once the horizon is drawn, the forest has grown and the o has
 * nearly risen.
 */
export const introTextAt = (mark: MarkOptions = DEFAULT_MARK): number =>
  DRAW_TOTAL + SPROUT_DELAY + O_RISE_AT * mark.sproutSeconds + 2;
/** When, in the opening, the f starts to sprout (seconds), and how long it takes. */
export const introSproutAt = (): number => DRAW_TOTAL + SPROUT_DELAY;
export const introSproutSeconds = (mark: MarkOptions = DEFAULT_MARK): number =>
  mark.sproutSeconds;

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
  buf: Float64Array | number[],
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
  let ink = INK;
  const markOpts = { ...mark };
  let blobNoise = createNoise2D(mulberry32(opts.seed * 17 + 1));
  const noise = createNoise2D(mulberry32(97));

  let trees: Tree[] = [];
  /** The f, planted in the skyline like a tree. */
  let markTree: Tree | null = null;
  /**
   * The orchestra's instruments among the trees: where each stands, how
   * tall, its shape, and how far it is shown (1) or sunk (0), animated
   * like a tree's morph; `delay` is its turn in the opening.
   */
  type Instrument = {
    kind: InstrumentKind;
    x: number;
    h: number;
    shape: Shape;
    delay: number;
    show: { from: number; to: number; start: number; seconds: number };
    /** How far it stands this frame: grown in the opening and shown on the page. */
    level: number;
  };
  let instruments: Instrument[] = [];
  let stumpTree: Tree | null = null;
  let buffer = new Float64Array(Math.max(MARK_POINTS, MARK_F.n) * 2);
  /** The f's outline for one frame, in viewBox units. */
  const fBuffer = new Float64Array(MARK_F.n * 2);
  /** The f's form before it has broken ground: nothing. */
  const markFlat = resampleOpen(flatShape(0.2), MARK_POINTS);
  /** The o as drawn this frame, on screen, for the pencil to trace. */
  const markO = new Float64Array(MARK_O.n * 2);
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
  /** The far hills' whole rise over the horizon at every ground sample, ridge and trees. */
  let farRise = new Float64Array(0);
  /** The forest floor seen close on the music page: tufts and little plants along the ground. */
  let floorBumps = new Float64Array(0);
  /**
   * Grass in the instruments' clearings on the home page: for every ground
   * sample, which instrument's clearing it is in (−1 for none) and how
   * much, fading out at the clearing's edge.
   */
  let grassOf = new Int8Array(0);
  let grassK = new Float64Array(0);
  let farColour = tinted(opts.farTint, ink);
  /**
   * The slowly varying part of the ground (hills and breath)
   * and the wind, tabled once a frame at a coarse pitch and read back by
   * interpolation: they change over tens of pixels.
   */
  let slow = new Float64Array(0);
  let slowWind = new Float64Array(0);
  let slowX0 = 0;
  let lastTime = 0;
  /** The pointer, −1..1 from the middle each way, and the look that follows it. */
  const pointer = { x: 0, y: 0 };
  const look = { x: 0, y: 0 };
  /** When the intro began, on the renderer's clock. */
  let introStart = DRAW_TOTAL;
  /** Whether the forest was drawn by the pencil (it then stands grown), not morphed out of a line. */
  let opening = true;
  /** The skyline the pencil drew, kept to fade over the trees as they grow into it. */
  let drawn = new Float64Array(0);
  let drawnN = 0;
  let gustStart = -1;
  let gustDir: 1 | -1 = 1;
  let nextGust = 6;
  let page: PageId = 'home';
  /**
   * How far each stage of a page change has gone, animated: the horizon
   * drawn up for about; the scene drawn in for music; the dive into the
   * land, and its edge drawn in to the trunk, for finds.
   */
  /** How far the o has set (it sinks for music, with the f). */
  const oSet = { from: 0, to: 0, start: -1e9 };
  const rooted = { from: 0, to: 0, start: -1e9 };
  const musical = { from: 0, to: 0, start: -1e9 };
  const dived = { from: 0, to: 0, start: -1e9 };
  const leafy = { from: 0, to: 0, start: -1e9 };
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
  let farCloudColour = tinted(opts.cloudTint * 0.5, ink);
  let clouds: Cloud[] = [];
  let cloudColour = tinted(opts.cloudTint, ink);
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
  /** How far the o has set: quick to set, slow to rise back. */
  const oLevel = (t: number) =>
    level(oSet, t, oSet.to < oSet.from ? O_RISE_BACK_SECONDS : O_SET_SECONDS);

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
  const formAt = (
    tree: Tree,
    t: number,
    out: Float64Array,
  ): Float64Array | number[] => {
    const a = tree.from;
    const b = tree.forms[tree.to];
    const elapsed = (t - tree.start) / tree.seconds;
    const n = tree.n;
    // Settled: the page's own form, as it is, no copy.
    if (elapsed >= 1) return b;
    if (tree.twoStage) {
      // Draws up a touch, then down into the ground whole, a beat, then up
      // out of it whole, past its height, and settles (a mushroom pops).
      const p1 = clamp01(elapsed / 0.45);
      const sink = p1 < 1 ? anticipate(p1, SINK_DRAW) : 1;
      const grow = swellPast(clamp01((elapsed - 0.45) / 0.55), MUSHROOM_SWELL);
      const src = sink < 1 ? a : b;
      const k = sink < 1 ? 1 - sink : grow;
      for (let j = 0; j < n * 2; j++) out[j] = src[j] * k;
      return out;
    }
    let reachA = 0;
    let reachB = 0;
    for (let j = 0; j < n; j++) {
      reachA = Math.max(reachA, Math.abs(a[2 * j + 1]));
      reachB = Math.max(reachB, Math.abs(b[2 * j + 1]));
    }
    const reach = Math.max(1e-6, reachA, reachB);
    // The f and the stump sink into the ground and grow back out of it
    // whole, shrinking about their foot, rather than pouring in top first
    // like a tree.
    const whole = tree.kind === 'mark' || tree.kind === 'stump';
    const stagger =
      whole && Math.min(reachA, reachB) < 2e-3 ? 0 : MORPH_STAGGER;
    // Growing, the height runs past and settles; sinking, it draws up
    // first. The widths just ease.
    const growing = reachB > 1.5 * reachA;
    const sinking = reachA > 1.5 * reachB;
    for (let j = 0; j < n; j++) {
      const far =
        Math.max(Math.abs(a[2 * j + 1]), Math.abs(b[2 * j + 1])) / reach;
      const key = 1 - far;
      const q = clamp01((elapsed - key * stagger) / (1 - stagger));
      const p = ease(q);
      const py = growing
        ? swellPast(q, GROW_SWELL)
        : sinking
          ? anticipate(q, SINK_DRAW)
          : p;
      // What sinks or grows whole keeps its proportions: both ways alike.
      out[2 * j] = a[2 * j] + (b[2 * j] - a[2 * j]) * (whole ? py : p);
      out[2 * j + 1] = a[2 * j + 1] + (b[2 * j + 1] - a[2 * j + 1]) * py;
    }
    return out;
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
    // The orchestra: the cello left of the mark, the drums just right of
    // it under the sun, the guitar as far right as the cello is left, each
    // in a little clearing of its own; the size of the tallest trees.
    const gapI = 0.6 * maxH;
    const plan: [InstrumentKind, number][] = [
      ['cello', 1.1 * maxH],
      ['drums', 0.95 * maxH],
      ['guitar', 1.1 * maxH],
      ['keys', 0.6 * maxH],
    ];
    const made = plan.map(([kind, h]) => ({ kind, h, shape: shapeOf(kind) }));
    const half = (i: number) => made[i].shape.halfWidth * made[i].h;
    // The drums right under the sun, a touch to its right: where the o
    // stands once risen.
    const root = markRoot();
    const sunX =
      root.x +
      ((oCentre.x + markOpts.oShift - LOGO_ROOT.x) * root.logoH) /
        LOGO_VIEWBOX.h;
    // Past the o's edge (its radius is about a seventh of the mark's height),
    // so the crook stands clear of the sun.
    const drumsX = sunX + 0.14 * root.logoH + 0.2 * half(1);
    // The guitar well out toward the corner, the cello as far the other way.
    const guitarX = Math.max(
      drumsX + half(1) + gapI + half(2),
      W / 2 + 0.38 * W,
    );
    const celloX = W - guitarX;
    // The keys under the f, as far left of the middle as the drums are right.
    const keysX = W - drumsX;
    // On a phone there is room only for the two at the sides.
    const phone = W < PHONE_WIDTH;
    instruments = [celloX, drumsX, guitarX, keysX]
      .map((x, i) => ({
        ...made[i],
        x,
        delay:
          0.05 +
          (opts.morphStagger * Math.abs(x - W / 2)) / (W / 2) +
          0.1 * rng(),
        // Planted on whatever page the forest is on: up only where they stand.
        show: {
          from: instrumentsStand(page) ? 1 : 0,
          to: instrumentsStand(page) ? 1 : 0,
          start: -1e9,
          seconds: 1,
        },
        level: 0,
      }))
      .filter((it) => !phone || it.kind === 'cello' || it.kind === 'guitar');
    const zones = instruments.map((it) => [
      it.x - it.shape.halfWidth * it.h - gapI,
      it.x + it.shape.halfWidth * it.h + gapI,
    ]);
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
        // Not in an instrument's clearing: step past it.
        for (const [z0, z1] of zones) {
          if (x + w / 2 > z0 && x - w / 2 < z1) {
            x = side > 0 ? z1 + w / 2 : z0 - w / 2;
          }
        }
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
          // Straight after the land has settled, the middle first.
          0.05 +
            (opts.morphStagger * Math.abs(x - W / 2)) / (W / 2) +
            0.15 * rng(),
          {
            home: tree,
            music,
            // The finds page dives through the forest as it stands; on
            // about it sinks into the ground before the camera draws back.
            finds: tree,
            about: flatShape(w / h),
          },
        );
      }
    };
    place(1, 2 * W + 0.1 * S);
    place(-1, -W - 0.1 * S);
    // The f of the mark, in the line like a tree: it sprouts, so its form
    // on the home and about pages is written every frame (`growMark`), and
    // the finds page dives into it, so there it is the home form itself;
    // on the music page it sinks back into the ground. Never a mound: the
    // sprout is its own intro.
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
    const markForms = list[list.length - 1].forms;
    markForms.finds = markForms.home;
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
    forgetMark();
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
    cloudColour = tinted(opts.cloudTint, ink);
    farCloudColour = tinted(opts.cloudTint * 0.5, ink);
    birdStarts = trees
      .filter((t) => t.kind !== 'mark' && t.kind !== 'stump')
      .sort((a, b) => Math.abs(a.x - W / 2) - Math.abs(b.x - W / 2))
      .slice(0, 4)
      .map((t) => ({ x: t.x, y: groundRest(t.x) - t.h }));
    plantFar();
    // Grass under the instruments, over their clearings.
    grassOf = new Int8Array(groundX.length).fill(-1);
    grassK = new Float64Array(groundX.length);
    instruments.forEach((it, j) => {
      const reach = 1.3 * (it.shape.halfWidth * it.h + gapI);
      for (let i = 0; i < groundX.length; i++) {
        const k = bump((groundX[i] - it.x) / reach);
        if (k > grassK[i]) {
          grassK[i] = k;
          grassOf[i] = j;
        }
      }
    });
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
    farColour = tinted(opts.farTint, ink);
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
    // The ridge: high at the edges, dipping under the mark, waving a
    // little, the treeline on top. Tabled once; a frame only scales it.
    farRise = new Float64Array(groundX.length);
    for (let i = 0; i < groundX.length; i++) {
      const c = (groundX[i] - W / 2) / (W / 2);
      const valley = 1 - (0.5 + 0.5 * Math.cos(Math.PI * c));
      farRise[i] =
        (opts.farHeight + opts.farDip * valley) * H +
        0.006 * H * Math.sin(5.3 * c + 1.1) +
        farBumps[i];
    }
  };

  const linear = (p: number) => p;
  /** Each stage's value now; the uneven ones run linear and ease per point. */
  const stageAt = {
    rooted: (t: number) => level(rooted, t, ABOUT_SECONDS, linear),
    musical: (t: number) => level(musical, t, SCENE_SECONDS),
    dived: (t: number) => level(dived, t, DIVE_SECONDS),
    leafy: (t: number) => level(leafy, t, CURTAIN_SECONDS, linear),
  };

  const setPage = (next: PageId, instant = false) => {
    const now = lastTime;
    const stages = { rooted, musical, dived, leafy };
    const keys = Object.keys(stages) as (keyof typeof stages)[];
    const target: Record<keyof typeof stages, boolean> = {
      rooted: next === 'about',
      musical: next === 'music',
      dived: next === 'finds',
      leafy: next === 'finds',
    };
    if (instant) {
      page = next;
      // Opened straight into a section: no blank sheet to draw on first.
      if (next !== 'home') {
        introStart = lastTime;
        opening = false;
      }
      for (const key of keys) {
        stages[key].from = stages[key].to = target[key] ? 1 : 0;
      }
      oSet.from = oSet.to = next === 'music' || next === 'finds' ? 1 : 0;
      for (const tree of trees) {
        tree.from = Float64Array.from(tree.forms[next]);
        tree.to = next;
        tree.start = -1e9;
      }
      for (const it of instruments) {
        it.show.from = it.show.to = instrumentsStand(next) ? 1 : 0;
        it.show.start = -1e9;
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
    // trunk's edge goes back off the right of the screen and the camera
    // rises out of the land; on about the horizon comes back down; on
    // music the scene draws back.
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
    // Then the next page's own stages run: for about once the forest has
    // sunk. The o sinks as the dive starts (the camera never leaves it
    // behind, so it would stand huge at the edge), and comes back only
    // once the hills are back.
    oSet.from = oLevel(now);
    oSet.to = next === 'finds' ? 1 : 0;
    oSet.start = now + out;
    const hiding = next === 'about' && page !== 'about';
    const entry = now + out + (hiding ? ABOUT_LEAD : 0);
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
    if (next === 'about') birdsLaunch = now + 0.1;
    // The forest stirs in the direction of travel.
    gust(next === 'music' || page === 'finds' ? 1 : -1);
    const toMusic = next === 'music';
    const fromMusic = page === 'music';
    for (const tree of trees) {
      const snapshot = new Float64Array(tree.n * 2);
      snapshot.set(formAt(tree, now, snapshot));
      tree.from = snapshot;
      tree.to = next;
      const d = Math.abs(tree.x - W / 2) / W;
      const jitter = 0.06 * ((tree.seed * 7) % 1);
      let wait = 0;
      let seconds = PAGE_MORPH_SECONDS;
      tree.twoStage = false;
      if (tree.kind === 'mark') {
        if (toMusic) seconds = MUSIC_SINK_SECONDS;
        else if (fromMusic) {
          wait = 0.45;
          seconds = 0.8;
        }
      } else if (tree.kind === 'stump') {
        if (toMusic) {
          wait = out + 0.45;
          seconds = 0.9;
        } else if (fromMusic) seconds = 0.5;
      } else if (toMusic || fromMusic) {
        tree.twoStage = true;
        wait = (toMusic ? out + 0.25 : 0.2) + 0.3 * d;
        seconds = 1;
      } else if (next === 'about') {
        seconds = ABOUT_HIDE_SECONDS;
        wait = 0.15 * d;
      } else if (page === 'about') {
        // Home again: the trees grow back as the land lands.
        wait = out + 0.1 + 0.15 * d;
      }
      // To and from finds the forest keeps its form: it goes with the
      // camera.
      tree.seconds = seconds;
      tree.start = now + wait + jitter;
    }
    // The instruments go into the ground for music and back up once home;
    // they stay on about (riding the horizon up) and go with the camera
    // for finds.
    for (const it of instruments) {
      const d = Math.abs(it.x - W / 2) / W;
      const standing = instrumentsStand(next) ? 1 : 0;
      it.show.from = showAt(it, now);
      it.show.to = standing;
      if (it.show.from === standing) continue;
      it.show.seconds = standing ? 0.9 : 0.5;
      it.show.start =
        now +
        (toMusic
          ? out + 0.25 + 0.3 * d
          : next === 'about'
            ? 0.15 * d
            : out + 0.1 + 0.15 * d);
    }
    page = next;
  };
  /**
   * The instruments stand on the home page, ride the horizon up into the
   * strip of sky on about, and go with the dive into art.
   */
  const instrumentsStand = (p: PageId) =>
    p === 'home' || p === 'about' || p === 'finds';
  /** How far an instrument is up: drawing up a touch before it sinks, swelling past as it grows. */
  const showAt = (it: Instrument, t: number) => {
    const { from, to, start, seconds } = it.show;
    const q = clamp01((t - start) / seconds);
    const curve =
      to > from ? swellPast(q, GROW_SWELL) : anticipate(q, SINK_DRAW);
    return from + (to - from) * curve;
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
  const setInk = (next: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(next)) return;
    ink = next;
    farColour = tinted(opts.farTint, ink);
    cloudColour = tinted(opts.cloudTint, ink);
    farCloudColour = tinted(opts.cloudTint * 0.5, ink);
  };
  const setMark = (next: MarkOptions) => {
    Object.assign(markOpts, next);
    forgetMark();
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
    const prevTime = lastTime;
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
    ctx.fillStyle = ink;

    const breath = 2.5 * u * Math.sin((time / opts.breathSeconds) * TAU);
    const rise = stageAt.rooted(time);
    const m = stageAt.musical(time);
    const dive = stageAt.dived(time);
    // The look follows the pointer with a lag, and only at home: on the
    // way to a section it eases back to the middle.
    {
      const dt = Math.min(0.1, Math.max(0, time - prevTime));
      const at = 1 - Math.max(ease(clamp01(rise)), m, clamp01(dive));
      const k = 1 - Math.exp(-dt / LOOK_SECONDS);
      look.x += (-pointer.x * at * opts.parallax - look.x) * k;
      look.y += (-pointer.y * at * opts.parallax - look.y) * k;
    }
    // On a phone the art page stays all ink: the edge is never drawn in.
    const pull = W < PHONE_WIDTH ? 0 : stageAt.leafy(time);
    // The o sets with the f for finds, early on the way out and only as
    // the hills come back on the way home; for music it sinks before the
    // scene draws in. On about the mark stays, riding up and shrinking.
    const oDown = oLevel(time);
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
      (1 + (MUSIC_ZOOM - 1) * m) * Math.exp(Math.log(DIVE_ZOOM) * dive);
    const lead = DIVE_LEAD * H * Math.sin(Math.PI * ease(clamp01(dive)));
    const px = W / 2;
    const py = groundRest(W / 2) + (m > 0 ? 0 : DIVE_DEPTH * H);
    const e = px - zoom * px + look.x * LOOK_LAND * u;
    const g = py - zoom * py + look.y * LOOK_LAND * u * 0.5;
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
    const swell = opening
      ? 1
      : ease(clamp01((intro - 0.2) / opts.morphSeconds));
    // Pushed out, never faded in: the clouds swell one after another once
    // all is drawn; the far hills rise from behind the land (and the birds
    // start crossing) last, with the text.
    const dawnRaw = opening
      ? clamp01((intro - (introTextAt(markOpts) - DRAW_TOTAL)) / DAWN_SECONDS)
      : 1;
    const grow = ease(dawnRaw);
    const cloudRaw = opening ? clamp01(intro / CLOUD_SECONDS) : 1;
    const dawn = opening ? 1 : swell;
    /** How far the horizon has been drawn up for about at a world x: the left a touch ahead. */
    const risen = (x: number) =>
      rise === 0
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
    // Not on about's strip of sky, and gone before the dive fills the screen.
    const sink = 1 - ease(clamp01(2 * dive));
    const skyShow = dawn * (1 - m) * (1 - ease(clamp01(rise))) * sink;
    if (skyShow > 0.01 && clouds.length > 0 && opts.cloudTint > 0) {
      ctx.globalAlpha = skyShow;
      clouds.forEach((cloud, i) => {
        const puff = ease(
          clamp01(cloudRaw * 1.6 - (0.6 * i) / Math.max(1, clouds.length - 1)),
        );
        if (puff <= 0.01) return;
        ctx.fillStyle = cloud.far ? farCloudColour : cloudColour;
        const span = W + 4 * cloud.size;
        const x =
          ((cloud.x0 + opts.cloudSpeed * u * cloud.drift * time) % span) -
          2 * cloud.size;
        // Past the land's own shift, the sky goes farther with the look.
        const shift = (cloud.far ? LOOK_FAR_CLOUDS : LOOK_CLOUDS) - LOOK_LAND;
        const cx = x + look.x * shift * u;
        const cy = cloud.y + look.y * shift * u * 0.5;
        for (let k = 0; k < CLOUD_POINTS; k++) {
          buffer[2 * k] = cx + cloud.shape[2 * k] * puff;
          buffer[2 * k + 1] = cy + cloud.shape[2 * k + 1] * puff;
        }
        ctx.beginPath();
        traceSmooth(ctx, buffer, CLOUD_POINTS);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
    }

    // The far hills first, behind everything: a faint ridge over the
    // horizon, high at the edges and dipping under the mark, a treeline
    // along it. They fade as the scene draws in for music and as the forest
    // hides.
    const farShow = dawn * (1 - m) * sink;
    // Not before they start to rise: their fill runs down behind the land,
    // and during the opening the land is not there yet to cover it.
    const farOn = farShow > 0.01 && grow > 0.001 && opts.farTint > 0;
    const lift = swell * grow;
    const hx = look.x * (LOOK_HILLS - LOOK_LAND) * u;
    const hy = look.y * (LOOK_HILLS - LOOK_LAND) * u * 0.5;
    if (farOn) {
      ctx.fillStyle = farColour;
      ctx.globalAlpha = farShow;
      ctx.beginPath();
      let first = true;
      let lastX = x0;
      for (let i = 0; i < groundX.length; i += 2) {
        const x = groundX[i] + hx;
        if (x < x0) continue;
        if (x > x1) break;
        const y = opts.horizon * H - farRise[i] * lift + breath + hy;
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
      ctx.fillStyle = ink;
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
    // Read back through a Catmull-Rom curve, not straight segments, so the
    // ground has no corners even when the camera draws in close.
    const slowAt = (table: Float64Array, x: number) => {
      const f = (x - slowX0) / SLOW_PITCH;
      const i = Math.max(0, Math.min(slowN - 2, Math.floor(f)));
      const t = Math.max(0, Math.min(1, f - i));
      const p0 = table[Math.max(0, i - 1)];
      const p1 = table[i];
      const p2 = table[i + 1];
      const p3 = table[Math.min(slowN - 1, i + 2)];
      return (
        p1 +
        0.5 *
          t *
          (p2 -
            p0 +
            t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
      );
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
      const g = grassOf[i];
      // Taller than the music page's floor, seen from farther away.
      const grass = g >= 0 ? 2 * grassK[i] * instruments[g].level : 0;
      return slowAt(slow, x) - tuft * Math.max(m, grass);
    };
    // How far each instrument stands this frame: the grass and the
    // instruments themselves read it.
    for (const it of instruments) {
      it.level =
        swellPast(clamp01((intro - it.delay) / opts.morphSeconds), GROW_SWELL) *
        showAt(it, time);
    }
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
    // The ground is sampled fine enough for the music page's tufts; with
    // none to draw, every other sample is plenty for a smooth line and
    // halves the path the browser has to fill.
    const stride = m > 0 ? 1 : 2;
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
      // While the pencil draws, the line it follows has every tree grown;
      // after, the trees grow into it from the middle outward as ever.
      const p =
        opening && intro < 0
          ? 1
          : ease(clamp01((intro - tree.delay) / opts.morphSeconds));
      if (p <= 0) continue;
      // A short mound, then the tree: most of the time is the growth.
      const toMound = ease(clamp01(p / 0.2));
      // Up past its height and settling, like everything that grows here.
      const toTree = swellPast(clamp01((p - 0.2) / 0.8), GROW_SWELL);
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
      // On about the whole forest shrinks with the mark as the camera
      // draws back.
      const h = tree.h * mk;
      const form = formAt(tree, time, shape);
      // Something that is not there on this page (a flat form) leaves the
      // ground alone: no mound on load, nothing spliced in.
      let tall = 0;
      for (let j = 1; j < tree.n * 2; j += 2) {
        tall = Math.max(tall, Math.abs(form[j]));
      }
      if (tall < 2e-3) continue;
      const grown = p >= 1;
      for (let j = 0; j < tree.n; j++) {
        let lx: number;
        let ly: number;
        if (grown) {
          lx = form[2 * j];
          ly = form[2 * j + 1];
        } else {
          const mx = mound[2 * j];
          const my = mound[2 * j + 1] * toMound;
          lx = mx + (form[2 * j] - mx) * toTree;
          ly = my + (form[2 * j + 1] - my) * toTree;
        }
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
        // Every sample where there is grass to draw.
        gi += grassOf[gi] >= 0 ? 1 : stride;
      }
      while (gi < groundX.length && groundX[gi] <= right) gi++;
      for (let j = 0; j < tree.n; j++) {
        emit(buffer[2 * j], buffer[2 * j + 1]);
      }
    }
    while (gi < groundX.length && groundX[gi] <= x1) {
      emit(groundX[gi], groundLine(groundX[gi]));
      gi += grassOf[gi] >= 0 ? 1 : stride;
    }

    ctx.beginPath();
    let pencilOver: (() => void) | null = null;
    if (intro < 0) {
      pencilOver = drawOpening(
        time - (introStart - DRAW_TOTAL),
        n,
        deep,
        groundLine,
      );
    } else if (dive >= 0.999) {
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
    pencilOver?.();
    // The pencil's drawing stays a moment over the land, fading as the
    // trees grow into it.
    if (
      opening &&
      intro >= 0 &&
      intro < OPENING_HOLD + OPENING_FADE &&
      drawnN > 1
    ) {
      strokePencil(
        drawn,
        drawnN,
        Number.POSITIVE_INFINITY,
        1 - ease(clamp01((intro - OPENING_HOLD) / OPENING_FADE)),
      );
    }
    camera();

    /**
     * What stands behind an instrument's cut-out, painted into its clip
     * over this stretch of the world (x0..x1): paper, the far hills, the
     * land. So a sound hole shows the hills through it, never a white
     * disc glowing on them.
     */
    const paintBehind = (
      bx0: number,
      bx1: number,
      by0: number,
      by1: number,
    ) => {
      camera();
      ctx.fillStyle = PAPER;
      ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      let gi = 0;
      while (gi < groundX.length && groundX[gi] + hx < bx0 - 4) gi++;
      const g0 = Math.max(0, gi - 2);
      if (farOn) {
        ctx.fillStyle = farColour;
        ctx.globalAlpha = farShow;
        ctx.beginPath();
        ctx.moveTo(groundX[g0] + hx, by1 + 4);
        for (let i = g0; i < groundX.length; i++) {
          const x = groundX[i] + hx;
          ctx.lineTo(x, opts.horizon * H - farRise[i] * lift + breath + hy);
          if (x > bx1 + 4) {
            ctx.lineTo(x, by1 + 4);
            break;
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(groundX[g0], by1 + 4);
      for (let i = g0; i < groundX.length; i++) {
        const x = groundX[i];
        ctx.lineTo(x, groundLine(x));
        if (x > bx1 + 4) {
          ctx.lineTo(x, by1 + 4);
          break;
        }
      }
      ctx.closePath();
      ctx.fill();
    };
    if (dive < 0.999) {
      drawInstruments(groundAt, paintBehind);
    }
    drawRecordPlayer(time, groundAt);
    // Off the home page the o sinks into the ground: early on the way in,
    // and only once the scene has nearly come home on the way back, so it
    // never pokes out of the stump. Back from art it rises the whole slow
    // way, a sun coming up.
    drawO(
      time,
      intro,
      oSet.to < oSet.from
        ? Math.max(clamp01((oDownMusic - 0.18) / 0.32), oDown)
        : clamp01((Math.max(oDownMusic, oDown) - 0.18) / 0.32),
      mk,
      groundAt,
      { x: markX, y: groundAt(markX), sx, sy },
    );
    ctx.setTransform(dprScale, 0, 0, dprScale, 0, 0);
    drawBirds(time, (x: number, y: number) => ({
      x: e + zoom * x,
      y: g + zoom * y,
    }));
    drawFlight(time, skyShow * grow);
  };

  const setPointer = (x: number, y: number) => {
    pointer.x = Math.max(-1, Math.min(1, x));
    pointer.y = Math.max(-1, Math.min(1, y));
  };

  /**
   * The opening, `d` seconds in: the pencil's tip runs the skyline (the
   * hills and every tree grown, `n` points of `line`) from left to right at
   * an even pace along it while the ink waits in a band at the bottom; then
   * the land, hills only (`groundLine`), rises from the band. Adds the ink
   * to the current path (filled by the caller) and returns the pencil's
   * stroke, to be drawn over the ink. Keeps the drawn line for the trees to
   * grow into afterwards.
   */
  const drawOpening = (
    d: number,
    n: number,
    deep: number,
    groundLine: (x: number) => number,
  ): (() => void) | null => {
    if (n < 2) return null;
    // The land poured in like water: a level rising from below the screen,
    // its surface sloshing in the glass of the screen (the first mode tips
    // it, left up while right is down, then back; the second ripples it),
    // the slosh dying down well before the land reaches the hills; over the
    // last stretch the surface settles into them, never running over.
    const below = 1.05 * H;
    // Poured at a steady rate that eases off as the glass fills.
    const poured = clamp01(
      (d - DRAW_WAIT * 0.5) / (DRAW_TOTAL - DRAW_WAIT * 0.5),
    );
    const p = 1 - (1 - poured) ** 2;
    const swing = Math.min(1, poured * 6) * (1 - poured) ** 2.5 * H;
    const level =
      below +
      (opts.horizon * H - below) * p -
      0.25 * RIPPLE * swing * Math.sin(TAU * 0.9 * d + 0.8);
    const tip = SLOSH * swing * Math.sin(TAU * SLOSH_HZ * d + 0.3);
    const ripple = RIPPLE * swing * Math.sin(TAU * RIPPLE_HZ * d + 1.7);
    const settle = ease(clamp01((p - 0.65) / 0.35));
    const xa = line[0];
    const xb = line[2 * (n - 1)];
    ctx.moveTo(xa, deep);
    for (let i = 0; i < groundX.length; i++) {
      const x = groundX[i];
      if (x < xa) continue;
      if (x > xb) break;
      const surface =
        level -
        tip * Math.cos((Math.PI * x) / W) -
        ripple * Math.cos((TAU * x) / W);
      const y = surface + (groundLine(x) - surface) * settle;
      ctx.lineTo(x, Math.min(below, y));
    }
    ctx.lineTo(xb, deep);
    ctx.closePath();
    if (drawn.length < n * 2) drawn = new Float64Array(line.length);
    drawn.set(line.subarray(0, n * 2));
    drawnN = n;
    let total = 0;
    for (let k = 1; k < n; k++) {
      total += Math.hypot(
        line[2 * k] - line[2 * k - 2],
        line[2 * k + 1] - line[2 * k - 1],
      );
    }
    const head = total * clamp01((d - DRAW_WAIT) / DRAW_SECONDS);
    if (head <= 0) return null;
    return () => strokePencil(line, n, head, 1);
  };

  /**
   * The pencil's line along `n` points of `pts` up to arc length `head`,
   * wandering a hand's width off them, at `alpha`.
   */
  /** The opening pencil's wander at every point of the line, found once: it does not change with time. */
  let wanderOf = new Float64Array(0);
  let wanderN = 0;
  const strokePencil = (
    pts: Float64Array,
    n: number,
    head: number,
    alpha: number,
  ) => {
    if (alpha <= 0) return;
    if (wanderN !== n) {
      if (wanderOf.length < n) wanderOf = new Float64Array(n + 64);
      let along = 0;
      for (let k = 0; k < n; k++) {
        if (k > 0) {
          along += Math.hypot(
            pts[2 * k] - pts[2 * k - 2],
            pts[2 * k + 1] - pts[2 * k - 1],
          );
        }
        wanderOf[k] =
          opts.pencilWander * u * noise(along / (opts.pencilWave * u), 0.3);
      }
      wanderN = n;
    }
    ctx.save();
    ctx.strokeStyle = PENCIL;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = opts.pencilWidth * u;
    ctx.globalAlpha = 0.9 * alpha;
    ctx.beginPath();
    let along = 0;
    for (let k = 0; k < n; k++) {
      if (k > 0) {
        along += Math.hypot(
          pts[2 * k] - pts[2 * k - 2],
          pts[2 * k + 1] - pts[2 * k - 1],
        );
        if (along > head) break;
      }
      const a = Math.max(0, k - 1);
      const b = Math.min(n - 1, k + 1);
      const dx = pts[2 * b] - pts[2 * a];
      const dy = pts[2 * b + 1] - pts[2 * a + 1];
      const len = Math.hypot(dx, dy) || 1;
      const w = wanderOf[k];
      const x = pts[2 * k] - (dy / len) * w;
      const y = pts[2 * k + 1] + (dx / len) * w;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
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
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5 * u;
    ctx.globalAlpha = show;
    for (let i = 0; i < flight.count; i++) {
      const lag = i * 0.09 * W;
      const x =
        (flight.from > 0 ? -0.1 * W + across - lag : 1.1 * W - across + lag) +
        look.x * LOOK_CLOUDS * u;
      const y =
        flight.y +
        look.y * LOOK_CLOUDS * u * 0.5 +
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
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2 * u;
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
      const size = 11 * u * Math.max(0.4, 1 - 0.14 * age);
      const flap = 0.2 + 0.8 * Math.sin(age * 13 + i * 1.7);
      drawBird(x, y, size, flap);
    });
  };

  /**
   * The record player, after the back of «Songs from the Wood»: there is no
   * record, the stump's own cut face is the disc. A paper face inside a rim
   * of bark, with growth rings drawn by hand that turn slowly like a record,
   * and a tone arm standing on the far edge of the cut with its head resting
   * on the rings.
   */
  /**
   * The rings' hand-drawn unevenness, tabled once per ring around the
   * circle: as the disc spins the table is read at a turning offset.
   */
  const RING_SHARES = [
    0.16, 0.27, 0.36, 0.43, 0.52, 0.6, 0.66, 0.74, 0.82, 0.9,
  ];
  const RING_STEPS = 96;
  const ringWobble = (() => {
    const table = new Float64Array(RING_SHARES.length * RING_STEPS);
    for (let i = 0; i < RING_SHARES.length; i++) {
      for (let q = 0; q < RING_STEPS; q++) {
        const a = (q / RING_STEPS) * TAU;
        table[i * RING_STEPS + q] =
          1 + 0.035 * noise(Math.cos(a) * 1.4 + i * 3.1, Math.sin(a) * 1.4);
      }
    }
    return table;
  })();
  /**
   * The orchestra over the land: each instrument at its foot on the
   * ground, scaled by how far it has grown (in the opening, like a tree)
   * and how far it stands on this page;
   * ink outlines, then the cut-outs and rims in paper.
   */
  const drawInstruments = (
    groundAt: (x: number) => number,
    paintBehind: (x0: number, x1: number, y0: number, y1: number) => void,
  ) => {
    /** Paints the background into the current path, clipped: a true cut-out. */
    const cutOut = (ox: number, oy: number, k: number, poly: number[]) => {
      ctx.save();
      ctx.clip();
      let x0 = Number.POSITIVE_INFINITY;
      let x1 = Number.NEGATIVE_INFINITY;
      let y0 = Number.POSITIVE_INFINITY;
      let y1 = Number.NEGATIVE_INFINITY;
      for (let j = 0; j < poly.length; j += 2) {
        x0 = Math.min(x0, poly[j]);
        x1 = Math.max(x1, poly[j]);
        y0 = Math.min(y0, poly[j + 1]);
        y1 = Math.max(y1, poly[j + 1]);
      }
      paintBehind(ox + x0 * k, ox + x1 * k, oy + y0 * k, oy + y1 * k);
      ctx.restore();
    };
    for (const it of instruments) {
      const k = it.h * it.level;
      if (k <= 0.01) continue;
      ctx.save();
      // Set a little into the ground, not perched on it.
      const ox = it.x;
      const sink = it.kind === 'keys' ? KEYS_SINK : INSTRUMENT_SINK;
      const oy = groundAt(it.x) + sink * k;
      ctx.translate(ox, oy);
      ctx.scale(k, k);
      ctx.fillStyle = ink;
      for (const poly of it.shape.ink) {
        ctx.beginPath();
        traceSmooth(ctx, poly, poly.length / 2);
        ctx.fill();
      }
      // The cut-outs show what is behind.
      for (const poly of it.shape.paper) {
        ctx.beginPath();
        traceSmooth(ctx, poly, poly.length / 2);
        cutOut(ox, oy, k, poly);
      }
      for (const [cx, cy, r, w] of it.shape.rings) {
        // Never thinner than a pixel on screen.
        const half = Math.max(w, 1 / k) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + half, 0, TAU);
        ctx.arc(cx, cy, Math.max(0, r - half), 0, TAU, true);
        ctx.save();
        ctx.clip('evenodd');
        paintBehind(
          ox + (cx - r - half) * k,
          ox + (cx + r + half) * k,
          oy + (cy - r - half) * k,
          oy + (cy + r + half) * k,
        );
        ctx.restore();
      }
      ctx.restore();
      ctx.fillStyle = ink;
    }
  };

  const drawRecordPlayer = (time: number, groundAt: (x: number) => number) => {
    const stump = stumpTree;
    if (!stump) return;
    // The face sits on the stump only once the stump has grown up to it.
    const form = formAt(stump, time, shape);
    let grown = 0;
    for (let j = 1; j < stump.n * 2; j += 2) {
      grown = Math.max(grown, -form[j]);
    }
    // On load straight onto the music page the stump still grows out of
    // its mound with the rest of the forest: the face waits for that too.
    const intro = ease(
      clamp01((time - introStart - stump.delay) / opts.morphSeconds),
    );
    grown *= ease(clamp01((intro - 0.2) / 0.8));
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
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.8, 0.008 * h);
    for (let i = 0; i < RING_SHARES.length; i++) {
      const k = RING_SHARES[i];
      ctx.beginPath();
      const steps = 48;
      for (let q = 0; q <= steps; q++) {
        const a = (q / steps) * TAU;
        // The table at the turned angle, between two entries.
        const at = (((((a - spin) / TAU) % 1) + 1) % 1) * RING_STEPS;
        const i0 = Math.floor(at);
        const f = at - i0;
        const w0 = ringWobble[i * RING_STEPS + (i0 % RING_STEPS)];
        const w1 = ringWobble[i * RING_STEPS + ((i0 + 1) % RING_STEPS)];
        const wob = w0 + (w1 - w0) * f;
        const x = cx + fx * k * wob * Math.cos(a);
        const y = fcy + fy * k * wob * Math.sin(a);
        if (q === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.fillStyle = ink;
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
    if (amp === 0) return () => 0;
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

  /** The f's outline cut at the ground, an open path in the making, and where it crosses the ground. */
  const cut: number[] = [];
  const crossK: number[] = [];
  const crossX: number[] = [];
  /** Arc length along `cut`, for the even resampling. */
  let cutS = new Float64Array(MARK_F.n + 4);
  /**
   * Once the f has grown its outline changes only by its breathing, which
   * is a push along fixed directions: the grown outline without it, and
   * the push of one unit, are kept so a frame is a sum, not a sprout.
   * With no breathing at all the cut form is written once and left.
   */
  let markBase: Float64Array | null = null;
  let markDir: Float64Array | null = null;
  let markStill = false;
  const forgetMark = () => {
    markBase = null;
    markDir = null;
    markStill = false;
  };

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
    const sc = tree.h / LOGO_VIEWBOX.h;
    if (progress < 1) {
      forgetMark();
      const pose = sproutPose(F_SPINE, progress, markOpts.coil);
      sproutOutline(
        F_SPINE,
        F_BOUND,
        pose,
        wobbleOf(time, MARK_F, 7, sc),
        fBuffer,
      );
    } else {
      if (!markBase || !markDir) {
        const pose = sproutPose(F_SPINE, 1, markOpts.coil);
        markBase = new Float64Array(MARK_F.n * 2);
        markDir = new Float64Array(MARK_F.n * 2);
        sproutOutline(F_SPINE, F_BOUND, pose, () => 0, markBase);
        sproutOutline(F_SPINE, F_BOUND, pose, () => 1, markDir);
        for (let k = 0; k < markDir.length; k++) markDir[k] -= markBase[k];
        markStill = false;
      }
      if (markOpts.markWobble === 0) {
        if (markStill) return;
        fBuffer.set(markBase);
        markStill = true;
      } else {
        const wobble = wobbleOf(time, MARK_F, 7, sc);
        for (let j = 0; j < MARK_F.n; j++) {
          const d = wobble(j);
          fBuffer[2 * j] = markBase[2 * j] + markDir[2 * j] * d;
          fBuffer[2 * j + 1] = markBase[2 * j + 1] + markDir[2 * j + 1] * d;
        }
      }
    }
    // Where the outline crosses the ground, walking round it.
    const N = MARK_F.n;
    const yc = F_CUT.y;
    crossK.length = 0;
    crossX.length = 0;
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
    // Left foot first: walked backwards if the cut came out the other way.
    const m = cut.length / 2;
    const backwards = cut[0] > cut[cut.length - 2];
    const px = (i: number) => cut[2 * (backwards ? m - 1 - i : i)];
    const py = (i: number) => cut[2 * (backwards ? m - 1 - i : i) + 1];
    // Resampled evenly by arc length straight into the tree's forms, in
    // its own units.
    if (cutS.length < m) cutS = new Float64Array(m + 16);
    cutS[0] = 0;
    for (let i = 1; i < m; i++) {
      cutS[i] = cutS[i - 1] + Math.hypot(px(i) - px(i - 1), py(i) - py(i - 1));
    }
    const length = cutS[m - 1];
    const vb = LOGO_VIEWBOX.h;
    let seg = 0;
    for (let j = 0; j < MARK_POINTS; j++) {
      const target = (j / (MARK_POINTS - 1)) * length;
      while (seg + 2 < m && cutS[seg + 1] <= target) seg++;
      const span = cutS[seg + 1] - cutS[seg] || 1;
      const t = Math.min(1, (target - cutS[seg]) / span);
      const x = (px(seg) + (px(seg + 1) - px(seg)) * t - F_CUT.x) / vb;
      const y = (py(seg) + (py(seg + 1) - py(seg)) * t - yc) / vb;
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
    ctx.fillStyle = ink;
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
    forgetMark();
    introStart = lastTime + DRAW_TOTAL;
    opening = true;
  };

  return {
    resize,
    setPixelRatio,
    draw,
    setOptions,
    setMark,
    setInk,
    restart,
    setPage,
    gust,
    windAt,
    setPointer,
    layout,
  };
};
