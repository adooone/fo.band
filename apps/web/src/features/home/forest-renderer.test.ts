import {
  bump,
  DEFAULT_OPTIONS,
  growForest,
  type PlantKind,
  profile,
} from './forest-renderer';

describe('growForest', () => {
  const forest = growForest(DEFAULT_OPTIONS.seed);
  const trees = forest.filter((p) => p.kind === 'crown' || p.kind === 'spire');

  it('plants trees across the width, none in the clearing', () => {
    expect(trees.length).toBeGreaterThan(15);
    for (const t of trees) {
      expect(Math.abs(t.x - 0.5)).toBeGreaterThan(DEFAULT_OPTIONS.clearing);
      expect(t.h).toBeGreaterThan(0.02);
      expect(t.h).toBeLessThan(0.3);
    }
    expect(trees.some((t) => t.x < 0.1)).toBe(true);
    expect(trees.some((t) => t.x > 0.9)).toBe(true);
  });

  it('puts grass everywhere and grows outward from the middle', () => {
    const tufts = forest.filter((p) => p.kind === 'tuft');
    expect(tufts.length).toBeGreaterThan(40);
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

describe('profile', () => {
  const kinds: PlantKind[] = ['crown', 'spire', 'bush', 'tuft'];
  it('is a smooth symmetric bump: 1 at the top, 0 past the edges, no steps', () => {
    for (const kind of kinds) {
      expect(profile(kind, 0)).toBe(1);
      expect(profile(kind, 1)).toBe(0);
      expect(profile(kind, -1.5)).toBe(0);
      let prev = profile(kind, -0.999);
      for (let u = -0.999; u <= 0; u += 0.001) {
        const v = profile(kind, u);
        expect(v).toBeCloseTo(profile(kind, -u), 9);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(v - prev).toBeLessThan(0.02);
        prev = v;
      }
    }
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
