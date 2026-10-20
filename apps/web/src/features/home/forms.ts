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

export type MushroomKind = 'bolete' | 'parasol' | 'bell';
const MUSHROOM_KINDS: MushroomKind[] = ['bolete', 'parasol', 'bell'];

/**
 * A mushroom for the forest floor around the record player: a stem that
 * flares a little at the ground, the cap's underside reaching out to its
 * rim, and the dome over the top. Boletes are stout and round, parasols
 * thin with a wide flat cap, bells have a tall pointed cap.
 */
export const mushroomShape = (seed: number, height = 0.5): number[] => {
  const rng = mulberry32(Math.floor(seed * 7919) + 23);
  const kind = MUSHROOM_KINDS[Math.floor(rng() * MUSHROOM_KINDS.length)];
  const lean = (rng() - 0.5) * 0.08 * height;
  const shape = {
    bolete: { stem: 0.5, stemW: 0.13, capW: 0.36, dome: 0.8 },
    parasol: { stem: 0.68, stemW: 0.055, capW: 0.42, dome: 0.45 },
    bell: { stem: 0.5, stemW: 0.07, capW: 0.26, dome: 1.7 },
  }[kind];
  const stemH = shape.stem * height;
  const capH = height - stemH;
  const sw = shape.stemW * height;
  const cw = shape.capW * height * (0.9 + 0.2 * rng());
  const out: number[] = [-sw * 1.25, 0, -sw, -stemH * 0.35];
  out.push(-sw * 0.85 + lean, -stemH * 0.95);
  // The underside out to the rim, the rim hanging a touch.
  out.push(-cw * 0.55 + lean, -stemH - 0.02 * height);
  out.push(-cw + lean, -stemH + 0.015 * height);
  const n = 22;
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (Math.PI * i) / n;
    out.push(
      cw * Math.cos(a) + lean,
      -stemH - capH * Math.sin(a) ** shape.dome,
    );
  }
  out.push(cw + lean, -stemH + 0.015 * height);
  out.push(cw * 0.55 + lean, -stemH - 0.02 * height);
  out.push(sw * 0.85 + lean, -stemH * 0.95, sw, -stemH * 0.35, sw * 1.25, 0);
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
 * The tree the whole skyline turns into on the finds page, in screen px
 * (y down): a trunk filling the strip on the right from below the bottom
 * edge to above the top, and near the top one long branch reaching left
 * toward the title, wavering and tapering like a real limb, with three
 * twigs forking off it and leaves on the twigs, on the branch and at its
 * tip. One open path from the trunk's foot at the bottom left, up its left
 * edge, out under the branch, round every twig and leaf on the way back,
 * over the top and down the right edge, so the land can flow into it.
 */
export const trunkOutline = (
  W: number,
  H: number,
  /** The trunk's width, of the screen width. */
  strip: number,
  seed: number,
): number[] => {
  const rng = mulberry32(Math.floor(seed * 7919) + 41);
  const out: number[] = [];
  const push = (x: number, y: number) => out.push(x, y);
  const left = W * (1 - strip);
  const right = 1.06 * W;
  const bottom = 1.18 * H;
  const top = -0.06 * H;
  const y0 = 0.17 * H;
  const reach = 0.6 * W;
  const lift = 0.05 * H;
  // The branch's centreline, left from the trunk, rising and wavering.
  const centre = (t: number) => ({
    x: left - reach * t,
    y:
      y0 -
      lift * t +
      0.028 * reach * Math.sin(2.6 * t + 0.3) -
      0.012 * reach * Math.sin(6.1 * t + 1.2),
  });
  const unit = (x: number, y: number) => {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  };
  /** Direction along the branch toward its tip. */
  const dir = (t: number) => {
    const a = centre(Math.max(0, t - 0.01));
    const b = centre(Math.min(1, t + 0.01));
    return unit(b.x - a.x, b.y - a.y);
  };
  /** Up from the branch (the normal on the sky side). */
  const up = (t: number) => {
    const d = dir(t);
    return { x: -d.y, y: d.x };
  };
  const hw = (t: number) => 0.034 * reach * (1 - 0.82 * t) + 1.2;
  const bark = (y: number) => 0.012 * W * Math.sin(y / (0.09 * H) + 1);

  // Up the trunk's left edge to the branch.
  const underAtTrunk = y0 + hw(0);
  for (let i = 0; i <= 10; i++) {
    const y = bottom + (underAtTrunk - bottom) * (i / 10);
    push(left + bark(y), y);
  }
  // Out under the branch.
  const n = 44;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const c = centre(t);
    const u = up(t);
    push(c.x - u.x * hw(t), c.y - u.y * hw(t));
  }
  /**
   * A leaf standing at `base`, its stalk along `d` (unit) and its blade
   * `h` tall, walked from its `-r` side to its `+r` side, `r` being `d`
   * turned a quarter clockwise on screen.
   */
  const leafAt = (
    base: { x: number; y: number },
    d: { x: number; y: number },
    h: number,
    k: number,
  ) => {
    const r = { x: -d.y, y: d.x };
    const leaf = leafShape(seed + k * 13, 1);
    for (let j = 0; j < leaf.length; j += 2) {
      const lx = leaf[j] * h;
      const ly = leaf[j + 1] * h;
      push(base.x + lx * r.x - ly * d.x, base.y + lx * r.y - ly * d.y);
    }
  };
  // The tip: a leaf pointing on along the branch.
  const tip = centre(1);
  leafAt(tip, dir(1), 0.06 * H, 9);
  // Back along the top edge: twigs forking up and leaves on the way.
  type Mark = { t: number; twig: boolean };
  const marks: Mark[] = [
    { t: 0.86, twig: false },
    { t: 0.74, twig: true },
    { t: 0.6, twig: false },
    { t: 0.47, twig: true },
    { t: 0.33, twig: false },
    { t: 0.2, twig: true },
  ];
  let next = 0;
  const steps = 44;
  let twigs = 0;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    while (next < marks.length && marks[next].t >= t) {
      const m = marks[next];
      const c = centre(m.t);
      const u = up(m.t);
      const d = dir(m.t);
      const base = { x: c.x + u.x * hw(m.t), y: c.y + u.y * hw(m.t) };
      if (m.twig) {
        // A twig: a thinner limb forking off toward the sky, bending a
        // touch, a leaf at its end.
        const a = (52 + 14 * twigs + 10 * rng()) * (Math.PI / 180);
        const td = unit(
          d.x * Math.cos(a) + u.x * Math.sin(a),
          d.y * Math.cos(a) + u.y * Math.sin(a),
        );
        const tr = { x: -td.y, y: td.x };
        const len = reach * (0.2 - 0.04 * twigs);
        const w0 = 0.5 * hw(m.t);
        const at = (sh: number, side: number) => {
          const bend = -0.12 * len * sh * sh;
          const w = w0 * (1 - 0.8 * sh) + 0.8;
          return {
            x: base.x + td.x * len * sh + tr.x * (bend + side * w),
            y: base.y + td.y * len * sh + tr.y * (bend + side * w),
          };
        };
        for (let q = 0; q <= 8; q++) {
          const p = at(q / 8, -1);
          push(p.x, p.y);
        }
        leafAt(at(1, 0), td, 0.055 * H, next);
        for (let q = 8; q >= 0; q--) {
          const p = at(q / 8, 1);
          push(p.x, p.y);
        }
        twigs++;
      } else {
        // A leaf on the branch itself, leaning toward the tip.
        const ld = unit(u.x + 0.35 * d.x, u.y + 0.35 * d.y);
        leafAt(base, ld, 0.07 * H, next);
      }
      next++;
    }
    const c = centre(t);
    const u = up(t);
    push(c.x + u.x * hw(t), c.y + u.y * hw(t));
  }
  // Up the trunk to the top, over, and down the right edge.
  const overAtTrunk = y0 - hw(0);
  for (let i = 1; i <= 6; i++) {
    const y = overAtTrunk + (top - overAtTrunk) * (i / 6);
    push(left + bark(y), y);
  }
  push((left + right) / 2, top);
  push(right, top);
  push(right, (top + bottom) / 2);
  push(right, bottom);
  return out;
};
