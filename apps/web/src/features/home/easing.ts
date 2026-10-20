/** The few curves every animation here is drawn with. */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Smootherstep: zero velocity and acceleration at both ends. */
export const ease = (p: number) => p * p * p * (p * (p * 6 - 15) + 10);
