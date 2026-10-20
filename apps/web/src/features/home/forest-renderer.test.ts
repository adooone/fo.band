import { createNoise2D } from 'simplex-noise';
import {
  bump,
  DEFAULT_OPTIONS,
  densify,
  growForest,
  mulberry32,
  plantShape,
} from './forest-renderer';

describe('growForest', () => {
  const forest = growForest(DEFAULT_OPTIONS.seed);
  const trees = forest.filter((p) => p.kind !== 'grass' && p.kind !== 'bush');

  it('plants trees across the width, none in the clearing', () => {
    expect(trees.length).toBeGreaterThan(20);
    for (const t of trees) {
      expect(Math.abs(t.x - 0.5)).toBeGreaterThan(DEFAULT_OPTIONS.clearing);
      expect(t.h).toBeGreaterThan(0.03);
      expect(t.h).toBeLessThan(0.3);
    }
    expect(trees.some((t) => t.x < 0.1)).toBe(true);
    expect(trees.some((t) => t.x > 0.9)).toBe(true);
  });

  it('puts grass everywhere, drawn last, and grows outward from the middle', () => {
    const grass = forest.filter((p) => p.kind === 'grass');
    expect(grass.length).toBeGreaterThan(100);
    const firstGrass = forest.findIndex((p) => p.kind === 'grass');
    expect(forest.slice(firstGrass).every((p) => p.kind === 'grass')).toBe(
      true,
    );
    const near = trees.filter((t) => Math.abs(t.x - 0.5) < 0.2);
    const far = trees.filter((t) => Math.abs(t.x - 0.5) > 0.4);
    const mean = (ps: typeof trees) =>
      ps.reduce((s, p) => s + p.delay, 0) / ps.length;
    expect(mean(near)).toBeLessThan(mean(far));
  });

  it('is the same forest for the same seed', () => {
    expect(growForest(5)).toEqual(growForest(5));
    expect(growForest(5)).not.toEqual(growForest(6));
  });
});

describe('plantShape', () => {
  const noise = createNoise2D(mulberry32(1));
  it('draws every kind as closed polygons standing on the ground', () => {
    for (const plant of growForest(2)) {
      for (const poly of plantShape(plant, noise)) {
        expect(poly.length % 2).toBe(0);
        expect(poly.length).toBeGreaterThanOrEqual(6);
        for (let i = 1; i < poly.length; i += 2) {
          expect(poly[i]).toBeLessThanOrEqual(0.15);
          expect(poly[i]).toBeGreaterThanOrEqual(-1.2);
        }
      }
    }
  });
});

describe('densify', () => {
  it('splits long edges and keeps the polygon closed', () => {
    const out = densify([0, 0, 10, 0, 10, 10, 0, 10], 2.5);
    expect(out.length / 2).toBe(16);
    expect(out.slice(0, 2)).toEqual([0, 0]);
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
