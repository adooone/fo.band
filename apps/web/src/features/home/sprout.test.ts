import { resample } from './forest-renderer';
import { LOGO_F, LOGO_F_SPINE } from './logo-paths';
import { flattenPath, outlineOf } from './path-outline';
import {
  bindOutline,
  buildSpine,
  OVERGROW,
  sproutOutline,
  sproutPose,
} from './sprout';

const spine = buildSpine(LOGO_F_SPINE);
const outline = outlineOf(resample(flattenPath(LOGO_F), 260));
const bound = bindOutline(spine, outline);
const out = new Float64Array(outline.n * 2);

describe('the f sprout', () => {
  it('turns one way along the whole spine, more than a full half-turn', () => {
    expect(spine.turn).toBe(1);
    expect(spine.theta[spine.n - 2] - spine.theta[0]).toBeGreaterThan(Math.PI);
    expect(spine.length).toBeGreaterThan(500);
  });

  it('ends exactly as the mark in Figma', () => {
    const pose = { grown: spine.length + OVERGROW, coil: 0, leaves: 1 };
    sproutOutline(spine, bound, pose, () => 0, out);
    for (let j = 0; j < outline.n; j++) {
      expect(out[2 * j]).toBeCloseTo(outline.x[j], 6);
      expect(out[2 * j + 1]).toBeCloseTo(outline.y[j], 6);
    }
    expect(sproutPose(spine, 1, 2.6)).toEqual({
      grown: spine.length + OVERGROW,
      coil: 0,
      leaves: 1,
    });
  });

  it('starts as a nub at the root and stays within reach while it grows', () => {
    for (const grown of [0, 40, 150]) {
      sproutOutline(
        spine,
        bound,
        { grown, coil: 2.6, leaves: 0 },
        () => 0,
        out,
      );
      for (let j = 0; j < outline.n; j++) {
        const d = Math.hypot(
          out[2 * j] - spine.x[0],
          out[2 * j + 1] - spine.y[0],
        );
        expect(d).toBeLessThan(grown + 25);
      }
    }
  });

  it('finds the leaves only at the crossbar, on both sides of the stem', () => {
    let left = 0;
    let right = 0;
    for (let j = 0; j < bound.n; j++) {
      if (bound.leaf[j] < 0.5) continue;
      // The crossbar sits between 700 and 750 in the mark's frame.
      expect(outline.y[j]).toBeGreaterThan(695);
      expect(outline.y[j]).toBeLessThan(750);
      if (outline.x[j] < 780) left++;
      else right++;
    }
    expect(left).toBeGreaterThan(5);
    expect(right).toBeGreaterThan(5);
  });

  it('keeps the stem smooth where the leaves will come out', () => {
    const pose = { grown: spine.length + OVERGROW, coil: 0, leaves: 0 };
    sproutOutline(spine, bound, pose, () => 0, out);
    for (let j = 0; j < bound.n; j++) {
      if (!bound.inLeaf[j]) continue;
      // The stem runs between about x 766 and 808 across the crossbar.
      expect(out[2 * j]).toBeGreaterThan(764);
      expect(out[2 * j]).toBeLessThan(810);
    }
    // Neighbouring points never jump: no spikes along the edge.
    for (let j = 0; j < bound.n; j++) {
      const k = (j + 1) % bound.n;
      const step = Math.hypot(
        out[2 * k] - out[2 * j],
        out[2 * k + 1] - out[2 * j + 1],
      );
      expect(step).toBeLessThan(12);
    }
  });

  it('grows, then unfurls, then puts out its leaves', () => {
    const early = sproutPose(spine, 0.3, 2.6);
    const mid = sproutPose(spine, 0.65, 2.6);
    expect(early.grown).toBeLessThan(mid.grown);
    expect(early.coil).toBe(2.6);
    expect(mid.coil).toBeLessThan(2.6);
    expect(mid.leaves).toBe(0);
    expect(sproutPose(spine, 0.9, 2.6).leaves).toBeGreaterThan(0.5);
  });
});
