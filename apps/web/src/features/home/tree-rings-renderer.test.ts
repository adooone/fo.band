import {
  bump,
  DEFAULT_OPTIONS,
  ellipsePerimeter,
  growthRings,
  sampleOutline,
  windX,
} from './tree-rings-renderer';

describe('growthRings', () => {
  it('runs from the bark inward, unevenly, with a few tight years', () => {
    const rings = growthRings(DEFAULT_OPTIONS.seed);
    expect(rings[0].f).toBe(1);
    expect(rings.length).toBeGreaterThan(10);
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i].f).toBeLessThan(rings[i - 1].f);
      expect(rings[i].f).toBeGreaterThanOrEqual(DEFAULT_OPTIONS.heart);
    }
    const steps = rings.slice(1).map((r, i) => rings[i].f - r.f);
    expect(Math.max(...steps) / Math.min(...steps)).toBeGreaterThan(2);
    expect(rings.some((r) => r.tight)).toBe(true);
  });

  it('is the same trunk for the same seed', () => {
    expect(growthRings(3)).toEqual(growthRings(3));
    expect(growthRings(3)).not.toEqual(growthRings(4));
  });
});

describe('sampleOutline', () => {
  it('walks a closed ellipse clockwise with unit outward normals', () => {
    const o = sampleOutline(100, 50, 80, 40, 200);
    expect(o.n).toBe(200);
    expect(o.length).toBeCloseTo(ellipsePerimeter(80, 40), -1);
    for (let j = 0; j < o.n; j++) {
      expect(Math.hypot(o.nx[j], o.ny[j])).toBeCloseTo(1, 5);
      // Outward: away from the centre.
      expect(
        o.nx[j] * (o.x[j] - 100) + o.ny[j] * (o.y[j] - 50),
      ).toBeGreaterThan(0);
    }
    expect(o.s[0]).toBe(0);
    expect(o.s[o.n - 1]).toBeLessThan(o.length);
  });
});

describe('wind', () => {
  it('crosses the screen once a period, entering and leaving off screen', () => {
    const sigma = 100;
    expect(windX(0, 10, 1000, sigma)).toBe(-2 * sigma);
    expect(windX(5, 10, 1000, sigma)).toBeCloseTo(500, 6);
    expect(windX(10, 10, 1000, sigma)).toBe(-2 * sigma);
    expect(windX(9.999, 10, 1000, sigma)).toBeGreaterThan(1000 + sigma);
  });

  it('is a soft bump that vanishes beyond its width', () => {
    expect(bump(0)).toBe(1);
    expect(bump(0.5)).toBeCloseTo(0.5, 6);
    expect(bump(1)).toBe(0);
    expect(bump(-3)).toBe(0);
  });
});
