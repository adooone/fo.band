import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from './rng';

/**
 * The shapes the forest turns into on each page, as open paths in a tree's
 * local units (base at the origin, 1 = the tree's height, y down), drawn
 * from the left end of the base to the right end so the skyline can splice
 * them in like trees. Every one is resampled to the same point count, so a
 * tree can flow into any of them.
 */

export type LeafKind = 'birch' | 'willow' | 'oak' | 'aspen';
const LEAF_KINDS: LeafKind[] = ['birch', 'willow', 'oak', 'aspen'];

/**
 * A leaf standing on its stalk: up the stalk's left edge, round the blade
 * from its base to the tip and back, down the stalk's right edge. Birch is
 * a soft oval with a point, willow narrow, oak lobed, aspen round.
 */
export const leafShape = (
  seed: number,
  height = 1.5,
  only?: LeafKind,
  /**
   * Stand it on a tree's trunk instead of a leaf's stalk: a short, stout
   * stub this tall (fraction of the height) flaring out at the ground, like
   * the round trees'.
   */
  trunk?: number,
  /** No stalk at all: the bare blade growing straight out of the ground. */
  bare = false,
): number[] => {
  const rng = mulberry32(Math.floor(seed * 7919) + 11);
  const pick = LEAF_KINDS[Math.floor(rng() * LEAF_KINDS.length)];
  const kind = only ?? pick;
  const stalk = bare ? 0 : (trunk ?? 0.16) * height;
  const blade = height - stalk;
  const sw = 0.025 * height;
  const width =
    kind === 'willow'
      ? 0.2
      : kind === 'aspen'
        ? 0.48
        : kind === 'oak'
          ? 0.4
          : 0.36;
  const bend = (rng() - 0.5) * 0.25;
  const n = 30;
  const half = (u: number) => {
    let h: number;
    if (kind === 'aspen') h = Math.sin(Math.PI * u ** 0.75) ** 0.8;
    else if (kind === 'willow') h = Math.sin(Math.PI * u) ** 0.9;
    else h = Math.sin(Math.PI * u ** 0.85) ** 0.7;
    if (kind === 'oak') h *= 1 + 0.16 * Math.sin(7 * Math.PI * u);
    return width * height * 0.5 * h;
  };
  const mid = (u: number) => bend * height * u * u;
  // On a trunk the blade's base widens smoothly into the trunk's top.
  const top = 0.085 * height;
  const foot = 0.13 * height;
  const side = (u: number) =>
    trunk === undefined ? half(u) : Math.max(half(u), top * (1 - u / 0.14));
  const out: number[] = bare
    ? [-sw, 0]
    : trunk === undefined
      ? [-sw, 0, -sw * 0.8, -stalk]
      : [-foot, 0, -top * 1.05, -stalk * 0.45, -top, -stalk];
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    out.push(mid(u) - side(u), -stalk - blade * u);
  }
  for (let i = n - 1; i >= 1; i--) {
    const u = i / n;
    out.push(mid(u) + side(u), -stalk - blade * u);
  }
  if (bare) out.push(sw, 0);
  else if (trunk === undefined) out.push(sw * 0.8, -stalk, sw, 0);
  else out.push(top, -stalk, top * 1.05, -stalk * 0.45, foot, 0);
  return out;
};

export type MushroomKind = 'bolete' | 'parasol' | 'bell' | 'agaric' | 'mycena';

/**
 * A mushroom for the forest floor around the record player, one tall: a
 * stem that flares a little at the ground, the cap's underside reaching
 * out to its rim, and the dome over the top. Boletes are stout and round,
 * parasols thin with a wide flat cap and a ring on the stem, bells have a
 * tall pointed cap, agarics a round cap on a stem with a skirt, mycenas
 * are tiny bells on long thin stems that grow in bunches. The outline is
 * open, from the left foot over the top to the right foot, `dx` across.
 */
export const mushroomShape = (
  seed: number,
  height = 0.5,
  kind?: MushroomKind,
  dx = 0,
): number[] => {
  const rng = mulberry32(Math.floor(seed * 7919) + 23);
  const pick: MushroomKind[] = ['bolete', 'parasol', 'bell', 'agaric'];
  const k = kind ?? pick[Math.floor(rng() * pick.length)];
  const lean = (rng() - 0.5) * 0.1 * height;
  const shape = {
    bolete: { stem: 0.5, stemW: 0.13, capW: 0.36, dome: 0.8, skirt: 0 },
    parasol: { stem: 0.68, stemW: 0.05, capW: 0.42, dome: 0.45, skirt: 0.6 },
    bell: { stem: 0.5, stemW: 0.07, capW: 0.26, dome: 1.7, skirt: 0 },
    agaric: { stem: 0.55, stemW: 0.09, capW: 0.36, dome: 1.0, skirt: 0.72 },
    mycena: { stem: 0.74, stemW: 0.035, capW: 0.16, dome: 1.4, skirt: 0 },
  }[k];
  const stemH = shape.stem * height;
  const capH = height - stemH;
  const sw = shape.stemW * height;
  const cw = shape.capW * height * (0.9 + 0.2 * rng());
  const out: number[] = [];
  const push = (x: number, y: number) => out.push(x + dx, y);
  const skirtY = shape.skirt * stemH;
  push(-sw * 1.25, 0);
  push(-sw, -stemH * 0.35);
  if (shape.skirt > 0) {
    // The skirt: a little collar hanging from the stem.
    push(-sw * 0.95, -skirtY + 0.05 * height);
    push(-sw * 2.1 + lean * 0.5, -skirtY + 0.02 * height);
    push(-sw * 1.6 + lean * 0.5, -skirtY - 0.03 * height);
    push(-sw * 0.9 + lean * 0.6, -skirtY - 0.04 * height);
  }
  push(-sw * 0.85 + lean, -stemH * 0.95);
  // The underside out to the rim, the rim hanging a touch.
  push(-cw * 0.55 + lean, -stemH - 0.02 * height);
  push(-cw + lean, -stemH + 0.015 * height);
  const n = 22;
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (Math.PI * i) / n;
    push(cw * Math.cos(a) + lean, -stemH - capH * Math.sin(a) ** shape.dome);
  }
  push(cw + lean, -stemH + 0.015 * height);
  push(cw * 0.55 + lean, -stemH - 0.02 * height);
  push(sw * 0.85 + lean, -stemH * 0.95);
  if (shape.skirt > 0) {
    push(sw * 0.9 + lean * 0.6, -skirtY - 0.04 * height);
    push(sw * 1.6 + lean * 0.5, -skirtY - 0.03 * height);
    push(sw * 2.1 + lean * 0.5, -skirtY + 0.02 * height);
    push(sw * 0.95, -skirtY + 0.05 * height);
  }
  push(sw, -stemH * 0.35);
  push(sw * 1.25, 0);
  return out;
};

/**
 * What grows where a tree stood on the music page: a mushroom, a pair, or
 * a bunch of mycenas on thin stems, side by side without overlapping, the
 * whole group no wider than `width` (local units of the tree, 1 = its
 * height) and set a little off its centre. One open outline from the left
 * foot to the right, the ground between the mushrooms.
 */
export const mushroomGroup = (seed: number, width: number): number[] => {
  const rng = mulberry32(Math.floor(seed * 7919) + 29);
  const roll = rng();
  type Member = { kind?: MushroomKind; h: number };
  let members: Member[];
  if (roll < 0.34) {
    members = [{ h: 0.55 + 0.25 * rng() }];
  } else if (roll < 0.62) {
    const big = 0.55 + 0.2 * rng();
    members = [{ h: big }, { h: big * (0.45 + 0.25 * rng()) }];
    if (rng() < 0.5) members.reverse();
  } else if (roll < 0.86) {
    const count = 3 + Math.floor(rng() * 3);
    members = [];
    for (let i = 0; i < count; i++) {
      members.push({ kind: 'mycena', h: 0.3 + 0.22 * rng() });
    }
  } else {
    members = [
      { kind: 'agaric', h: 0.65 + 0.12 * rng() },
      { kind: 'mycena', h: 0.26 + 0.1 * rng() },
      { kind: 'mycena', h: 0.3 + 0.1 * rng() },
    ];
  }
  // Cap widths set the spacing: caps nearly touch, never overlap.
  const capW = (m: Member) =>
    (m.kind === 'mycena' ? 0.16 : m.kind === 'agaric' ? 0.36 : 0.4) * m.h;
  const xs: number[] = [];
  let x = 0;
  members.forEach((m, i) => {
    if (i > 0) x += (capW(members[i - 1]) + capW(m)) * (0.55 + 0.35 * rng());
    xs.push(x);
  });
  const span = x + capW(members[0]) + capW(members[members.length - 1]);
  const fit = Math.min(1, (0.95 * width) / span);
  const shift = (rng() - 0.5) * Math.max(0, width - span * fit) * 0.8;
  const centre = x / 2;
  const out: number[] = [];
  members.forEach((m, i) => {
    const dx = (xs[i] - centre) * fit + shift;
    const shape = mushroomShape(seed + i * 17, m.h * fit, m.kind, dx);
    if (i > 0) out.push((out[out.length - 2] + shape[0]) / 2, 0);
    out.push(...shape);
  });
  return out;
};

/** How the record player's stump is cut: its width and how tilted its top face looks. */
export const STUMP = { width: 1.15, tilt: 0.3 } as const;

const stumpSide = (r: number, y: number) =>
  r * (0.97 + 0.62 * Math.exp(-y / 0.09) + 0.05 * Math.sin(Math.PI * y));

/**
 * The cut face on top of the stump, in local units: an ellipse seen from a
 * little above, its top edge at the stump's full height.
 */
export const stumpTop = (width = STUMP.width, tilt = STUMP.tilt) => {
  const ry = tilt * (width / 2);
  const rx = stumpSide(width / 2, 1 - ry);
  return { rx, ry, cy: -(1 - ry) };
};

/**
 * The stump of the record player, after the back of «Songs from the Wood»:
 * sides that swell out into the roots at the ground, a slight bulge of bark,
 * and on top the far half of the cut face, so the silhouette ends in the
 * curve of the ellipse the record is drawn on. One tall, `width` wide at
 * the cut (both in local units).
 */
export const stumpShape = (
  width = STUMP.width,
  tilt = STUMP.tilt,
): number[] => {
  const r = width / 2;
  const top = stumpTop(width, tilt);
  const n = 18;
  const out: number[] = [];
  const rise = -top.cy;
  for (let i = 0; i <= n; i++) {
    const y = rise * (i / n) ** 1.3;
    out.push(-stumpSide(r, y), -y);
  }
  // Over the far edge of the cut, left to right.
  const m = 24;
  for (let i = 1; i < m; i++) {
    const a = Math.PI + (Math.PI * i) / m;
    out.push(top.rx * Math.cos(a), top.cy + top.ry * Math.sin(a));
  }
  for (let i = n; i >= 0; i--) {
    const y = rise * (i / n) ** 1.3;
    out.push(stumpSide(r, y), -y);
  }
  return out;
};

/** A flat stretch of ground `width` wide: the form of a thing that is not there. */
export const flatShape = (width: number): number[] => [
  -width / 2,
  0,
  0,
  0,
  width / 2,
  0,
];

/**
 * The trunk the whole skyline turns into on the finds page, in screen px
 * (y down): a column filling the strip on the right from below the bottom
 * edge to above the top, its left edge rough with bark and swelling into a
 * collar where the branch leaves it (`y0` down from the top). One open path
 * from the foot at the bottom left, up the left edge, over the top and down
 * the right edge, so the land can flow into it. The branch itself grows
 * separately (branch.ts).
 */
/** Points along the trunk's left edge, from its foot to its top. */
export const TRUNK_EDGE_POINTS = 80;
export const trunkOutline = (
  W: number,
  H: number,
  /** The trunk's width, of the screen width. */
  strip: number,
  y0: number,
  seed: number,
): number[] => {
  const noise = createNoise2D(mulberry32(Math.floor(seed * 7919) + 41));
  const out: number[] = [];
  const left = W * (1 - strip);
  const right = 1.06 * W;
  const bottom = 1.18 * H;
  const top = -0.06 * H;
  // Bark in two octaves, and the collar: a bulge toward the branch.
  const collar = 0.024 * W;
  const edge = (y: number) => {
    const bark =
      0.008 * W * noise(y / (0.11 * H), 0.3) +
      0.0035 * W * noise(y / (0.035 * H), 2.7);
    const c = (y - (y0 + 0.012 * H)) / (2 * collar);
    const bulge = c <= -1 || c >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * c);
    return left + bark - collar * 0.35 * bulge;
  };
  const n = TRUNK_EDGE_POINTS;
  for (let i = 0; i <= n; i++) {
    const y = bottom + (top - bottom) * (i / n);
    out.push(edge(y), y);
  }
  out.push((left + right) / 2, top);
  out.push(right, top);
  out.push(right, (top + bottom) / 2);
  out.push(right, bottom);
  return out;
};
