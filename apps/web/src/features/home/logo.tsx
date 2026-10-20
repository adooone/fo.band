import { type RefObject, useEffect, useRef } from 'react';
import { createNoise2D } from 'simplex-noise';
import { createClock, prefersReducedMotion, subscribeTick } from '@/lib/ticker';
import type { ForestRenderer, MarkOptions } from './forest-renderer';
import { LOGO_F, LOGO_O, LOGO_ROOT, LOGO_VIEWBOX } from './logo-paths';

type LogoProps = {
  /** Where the sprout's stem meets the ground, in CSS px. */
  root: { x: number; y: number } | null;
  /** Height of the whole mark in CSS px. */
  height: number;
  mark: MarkOptions;
  forest: RefObject<ForestRenderer | null>;
};

const F_RISE_DELAY = 0.9;
const F_RISE_SECONDS = 2.4;
const O_RISE_DELAY = 2;
const O_RISE_SECONDS = 3;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (p: number) => p * p * p * (p * (p * 6 - 15) + 10);

/**
 * The mark: the f is a sprout growing out of the forest, the o a sun hanging
 * above the horizon beside it. On load the f rises smoothly out of the
 * ground with the morphing forest and the o rises after it; then the f sways
 * with the forest's wind and the o floats very slowly. All of it on the
 * shared loop and clamped clock.
 */
export const Logo = ({ root, height, mark, forest }: LogoProps) => {
  const fRef = useRef<SVGPathElement>(null);
  const oRef = useRef<SVGPathElement>(null);
  const rootRef = useRef(root);
  rootRef.current = root;
  const markRef = useRef(mark);
  markRef.current = mark;

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
        : ease(clamp01((t - F_RISE_DELAY) / F_RISE_SECONDS));
      const rise = reduced
        ? 1
        : ease(clamp01((t - O_RISE_DELAY) / O_RISE_SECONDS));
      const wind = rootRef.current
        ? (forest.current?.windAt(rootRef.current.x) ?? 0)
        : 0;
      // Lean a little with the wind, plus a sway of its own.
      const angle =
        (reduced ? 0 : 1.1 * noise(t * 0.17, 5) + 2.2 * wind) * grow;
      f.setAttribute(
        'transform',
        `translate(${rx} ${ry}) rotate(${angle.toFixed(3)}) scale(${(0.9 + 0.1 * grow).toFixed(4)} ${grow.toFixed(4)}) translate(${-rx} ${-ry})`,
      );
      const { oLift, oShift } = markRef.current;
      const bob = reduced ? 0 : 3 * Math.sin((t / 9) * Math.PI * 2);
      const lift = oLift * rise - 150 * (1 - rise) + bob;
      const shift = oShift * rise;
      o.setAttribute(
        'transform',
        `translate(${shift.toFixed(2)} ${(-lift).toFixed(2)})`,
      );
      o.setAttribute('opacity', (0.1 + 0.9 * rise).toFixed(3));
    };
    pose(reduced ? 10 : 0);
    if (reduced) return;
    return subscribeTick((now) => pose(clock.tick(now)));
  }, [forest]);

  const scale = height / LOGO_VIEWBOX.h;
  const left = root ? root.x - (LOGO_ROOT.x - LOGO_VIEWBOX.x) * scale : 0;
  const top = root ? root.y - (LOGO_ROOT.y - LOGO_VIEWBOX.y) * scale : 0;
  const width = LOGO_VIEWBOX.w + mark.oShift;

  return (
    <svg
      aria-label="fo"
      role="img"
      className="pointer-events-none absolute overflow-visible fill-ink"
      style={{
        left,
        top,
        width: width * scale,
        height,
        visibility: root ? 'visible' : 'hidden',
      }}
      viewBox={`${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${width} ${LOGO_VIEWBOX.h}`}
    >
      <title>fo</title>
      <path ref={oRef} d={LOGO_O} />
      <path ref={fRef} d={LOGO_F} />
    </svg>
  );
};
