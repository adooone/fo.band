/** The few curves every animation here is drawn with. */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Smootherstep: zero velocity and acceleration at both ends. */
export const ease = (p: number) => p * p * p * (p * (p * 6 - 15) + 10);

/**
 * Draws back below 0 first, then eases in, like a breath before a jump:
 * `c1` sets how far back (1.7 is a tenth of the way, 0.8 a fortieth).
 */
export const anticipate = (p: number, c1 = 1.7) => p * p * ((c1 + 1) * p - c1);

/**
 * Eases out past 1 and settles back, like a spring let go: `c1` sets how
 * far past (1.7 is a tenth of the way, 0.8 a fortieth).
 */
export const overshoot = (p: number, c1 = 1.7) =>
  1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2;

/** Where `overshoot(p, c1)` first reaches 1, as a share of the run. */
export const overshootAt = (c1: number) => 1 - c1 / (c1 + 1);

/**
 * Eases in and out with give at both ends: a breath back before it goes,
 * a run past the mark and a settle at the end; `c1` as for `overshoot`.
 */
export const glide = (p: number, c1 = 1.7) => {
  const c2 = c1 * 1.525;
  return p < 0.5
    ? (4 * p * p * ((c2 + 1) * 2 * p - c2)) / 2
    : ((2 * p - 2) ** 2 * ((c2 + 1) * (2 * p - 2) + c2) + 2) / 2;
};

/** Where `glide(p, c1)` first reaches 1, as a share of the run. */
export const glideAt = (c1: number) => {
  const c2 = c1 * 1.525;
  return 1 - c2 / (2 * (c2 + 1));
};

/**
 * Eases out, runs a little past 1 from halfway on and comes back over the
 * last third, no twitch: a swell, not a bounce. `c` sets how far past
 * (2 is about 4%, 1.8 about 2%; below 1 it never passes 1).
 */
export const swell = (p: number, c = 1.8) => 1 - (1 - p) ** 2 * (1 - c * p);

/** Where `swell(p, c)` first reaches 1, as a share of the run. */
export const swellAt = (c: number) => 1 / c;
