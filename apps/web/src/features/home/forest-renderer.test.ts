import { createNoise2D } from 'simplex-noise';
import {
  bump,
  moundShape,
  mulberry32,
  POINTS,
  resample,
  resampleOpen,
  type TreeKind,
  treeShape,
} from './forest-renderer';

describe('resample', () => {
  it('spreads the points evenly around a closed polygon, starting at the first', () => {
    const out = resample([0, 0, 10, 0, 10, 10, 0, 10], 8);
    expect(out.length).toBe(16);
    expect(out.slice(0, 2)).toEqual([0, 0]);
    expect(out.slice(2, 4)).toEqual([5, 0]);
    expect(out.slice(8, 10)).toEqual([10, 10]);
  });
});

describe('treeShape', () => {
  const noise = createNoise2D(mulberry32(1));
  const kinds: TreeKind[] = ['round', 'oval', 'spruce', 'bush'];

  it('stands on the ground, one tall, starting at the base and going over the top', () => {
    for (const kind of kinds) {
      const shape = treeShape(kind, 0.7, 3, 0.3, noise);
      let top = 0;
      for (let i = 1; i < shape.length; i += 2) {
        expect(shape[i]).toBeLessThanOrEqual(0.001);
        top = Math.min(top, shape[i]);
      }
      expect(top).toBeLessThan(-0.85);
      expect(top).toBeGreaterThan(-1.15);
      // Starts left of the middle on the ground, ends right of it.
      expect(shape[0]).toBeLessThan(0);
      expect(shape[1]).toBeCloseTo(0, 6);
      expect(shape[shape.length - 2]).toBeGreaterThan(0);
    }
  });

  it('morphs from a mound with the same point count and the same ends on the ground', () => {
    const tree = resampleOpen(treeShape('spruce', 0.5, 2, 0.3, noise), POINTS);
    const mound = resampleOpen(moundShape(0.5), POINTS);
    expect(tree.length).toBe(POINTS * 2);
    expect(mound.length).toBe(POINTS * 2);
    for (const path of [tree, mound]) {
      expect(path[1]).toBeCloseTo(0, 6);
      expect(path[path.length - 1]).toBeCloseTo(0, 6);
      expect(path[0]).toBeLessThan(0);
      expect(path[path.length - 2]).toBeGreaterThan(0);
    }
    for (let i = 1; i < mound.length; i += 2) {
      expect(mound[i]).toBeLessThanOrEqual(1e-9);
      expect(mound[i]).toBeGreaterThanOrEqual(-0.13);
    }
  });
});

describe('resampleOpen', () => {
  it('spreads the points evenly from the first point to the last', () => {
    const out = resampleOpen([0, 0, 10, 0, 10, 10], 5);
    expect(out).toEqual([0, 0, 5, 0, 10, 0, 10, 5, 10, 10]);
  });
});

describe('bump', () => {
  it('is a soft bump that vanishes beyond its width', () => {
    expect(bump(0)).toBe(1);
    expect(bump(0.5)).toBeCloseTo(0.5, 6);
    expect(bump(1)).toBe(0);
    expect(bump(-3)).toBe(0);
  });
});
