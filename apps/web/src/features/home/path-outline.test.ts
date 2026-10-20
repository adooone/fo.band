import { LOGO_F, LOGO_O } from './logo-paths';
import { flattenPath, outlineOf } from './path-outline';

describe('flattenPath', () => {
  it('reads absolute M, L, C and Z into a closed polygon', () => {
    // Control points at thirds make the cubic a straight line.
    const poly = flattenPath(
      'M0 0L10 0C10 3.3333333 10 6.6666667 10 10L0 10Z',
      2,
    );
    expect(poly.length).toBe(10);
    expect(poly.slice(0, 4)).toEqual([0, 0, 10, 0]);
    expect(poly[4]).toBeCloseTo(10, 6);
    expect(poly[5]).toBeCloseTo(5, 5);
    expect(poly.slice(6)).toEqual([10, 10, 0, 10]);
  });

  it('flattens the mark into outlines of the right size', () => {
    const f = flattenPath(LOGO_F);
    const o = flattenPath(LOGO_O);
    const box = (p: number[]) => {
      const xs = p.filter((_, i) => i % 2 === 0);
      const ys = p.filter((_, i) => i % 2 === 1);
      return [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ];
    };
    const [fx0, fy0, fx1, fy1] = box(f);
    expect(fx0).toBeCloseTo(734, 0);
    expect(fy0).toBeGreaterThan(438);
    expect(fx1).toBeLessThan(995);
    expect(fy1).toBeCloseTo(813, 0);
    const [ox0, oy0, ox1, oy1] = box(o);
    expect(ox0).toBeGreaterThan(855);
    expect(oy0).toBeGreaterThan(654);
    expect(ox1).toBeLessThan(1000);
    expect(oy1).toBeLessThan(810);
  });
});

describe('outlineOf', () => {
  it('gives unit outward normals and arc length, whichever way the polygon winds', () => {
    for (const poly of [
      [0, 0, 10, 0, 10, 10, 0, 10],
      [0, 0, 0, 10, 10, 10, 10, 0],
    ]) {
      const o = outlineOf(poly);
      expect(o.length).toBe(40);
      expect(o.s[0]).toBe(0);
      for (let j = 0; j < o.n; j++) {
        expect(Math.hypot(o.nx[j], o.ny[j])).toBeCloseTo(1, 6);
        expect(o.nx[j] * (o.x[j] - 5) + o.ny[j] * (o.y[j] - 5)).toBeGreaterThan(
          0,
        );
      }
    }
  });
});
