import { type RefObject, useEffect, useRef } from 'react';
import { createNoise2D } from 'simplex-noise';
import { createClock, prefersReducedMotion, subscribeTick } from '@/lib/ticker';
import type { ForestRenderer } from './forest-renderer';
import { LOGO_F, LOGO_O, LOGO_ROOT, LOGO_VIEWBOX } from './logo-paths';

type LogoProps = {
  /** Where the sprout's stem meets the ground, in CSS px. */
  root: { x: number; y: number } | null;
  /** Height of the whole mark in CSS px. */
  height: number;
  forest: RefObject<ForestRenderer | null>;
};

/**
 * Where the o settles relative to Figma, in viewBox units: up above the
 * horizon and a little to the right, clear of the frond, like a sun beside
 * the sprout.
 */
export const O_LIFT = 72;
export const O_SHIFT = 88;
const F_GROW_DELAY = 0.7;
const F_GROW_SECONDS = 2.2;
const O_RISE_DELAY = 1.6;
const O_RISE_SECONDS = 3.2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutBack = (p: number, c1 = 0.9) => {
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};
const easeOut = (p: number) => 1 - (1 - p) ** 3;

/**
 * The mark: the f is a sprout growing out of the forest, the o a sun hanging
 * above the horizon. On load the f shoots up from the ground and the o rises;
 * then the f sways with the forest's wind and the o floats very slowly. All
 * of it on the shared loop and clamped clock.
 */
export const Logo = ({ root, height, forest }: LogoProps) => {
  const fRef = useRef<SVGPathElement>(null);
  const oRef = useRef<SVGPathElement>(null);
  const rootRef = useRef(root);
  rootRef.current = root;

  useEffect(() => {
    const f = fRef.current;
    const o = oRef.current;
    if (!f || !o) return;
    const reduced = prefersReducedMotion();
    const clock = createClock(reduced);
    const noise = createNoise2D();
    const rx = LOGO_ROOT.x;
    const ry = LOGO_ROOT.y;
    const pose = (t: number) => {
      const grow = reduced
        ? 1
        : easeOutBack(clamp01((t - F_GROW_DELAY) / F_GROW_SECONDS));
      const rise = reduced
        ? 1
        : easeOut(clamp01((t - O_RISE_DELAY) / O_RISE_SECONDS));
      const wind = rootRef.current
        ? (forest.current?.windAt(rootRef.current.x) ?? 0)
        : 0;
      // Lean a little with the wind, plus a sway of its own.
      const angle =
        (reduced ? 0 : 1.1 * noise(t * 0.17, 5) + 2.2 * wind) * grow;
      f.setAttribute(
        'transform',
        `translate(${rx} ${ry}) rotate(${angle.toFixed(3)}) scale(${(0.97 + 0.03 * grow).toFixed(4)} ${grow.toFixed(4)}) translate(${-rx} ${-ry})`,
      );
      const bob = reduced ? 0 : 3 * Math.sin((t / 9) * Math.PI * 2);
      const lift = O_LIFT * rise - 150 * (1 - rise) + bob;
      const shift = O_SHIFT * rise;
      o.setAttribute(
        'transform',
        `translate(${shift.toFixed(2)} ${(-lift).toFixed(2)})`,
      );
      o.setAttribute('opacity', (0.15 + 0.85 * rise).toFixed(3));
    };
    pose(reduced ? 10 : 0);
    if (reduced) return;
    return subscribeTick((now) => pose(clock.tick(now)));
  }, [forest]);

  const scale = height / LOGO_VIEWBOX.h;
  const left = root ? root.x - (LOGO_ROOT.x - LOGO_VIEWBOX.x) * scale : 0;
  const top = root ? root.y - (LOGO_ROOT.y - LOGO_VIEWBOX.y) * scale : 0;

  return (
    <svg
      aria-label="fo"
      role="img"
      className="pointer-events-none absolute overflow-visible fill-ink"
      style={{
        left,
        top,
        width: (LOGO_VIEWBOX.w + O_SHIFT) * scale,
        height,
        visibility: root ? 'visible' : 'hidden',
      }}
      viewBox={`${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${LOGO_VIEWBOX.w + O_SHIFT} ${LOGO_VIEWBOX.h}`}
    >
      <title>fo</title>
      <path ref={oRef} d={LOGO_O} />
      <path ref={fRef} d={LOGO_F} />
    </svg>
  );
};
