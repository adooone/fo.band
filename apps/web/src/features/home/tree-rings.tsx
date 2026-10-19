import { useEffect, useRef } from 'react';
import {
  cappedDpr,
  createClock,
  prefersReducedMotion,
  subscribeTick,
} from '@/lib/ticker';
import {
  type RingsOptions,
  type TreeRingsRenderer,
  createTreeRingsRenderer,
} from './tree-rings-renderer';

type TreeRingsProps = {
  className?: string;
  options?: Partial<RingsOptions>;
  /** Fraction of the outer radius whose ring stays lit (the open section's). */
  held?: number | null;
  /** Called with the pith's position (CSS px) whenever the layout changes. */
  onPith?: (pith: { x: number; y: number }) => void;
};

/**
 * Frame pacing thresholds for adaptive quality: sustained slow frames lower
 * the detail (fewer points, fewer pixels), sustained fast ones restore it.
 */
const SLOW_FRAME_MS = 22;
const FAST_FRAME_MS = 12;
const SLOW_FRAMES_TO_DROP = 45;
const FAST_FRAMES_TO_RAISE = 240;

/** The trunk on a canvas, on the page's shared animation loop. */
export const TreeRings = ({
  className,
  options,
  held = null,
  onPith,
}: TreeRingsProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const onPithRef = useRef(onPith);
  onPithRef.current = onPith;
  const rendererRef = useRef<TreeRingsRenderer | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const heldRef = useRef(held);
  heldRef.current = held;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = createTreeRingsRenderer(canvas, optionsRef.current);
    if (!renderer) return;
    rendererRef.current = renderer;

    const reduced = prefersReducedMotion();
    const clock = createClock(reduced);

    const applyHeld = () => {
      const fraction = heldRef.current;
      renderer.setHeld(fraction === null ? null : renderer.ringAt(fraction));
    };
    const resize = () => {
      renderer.resize(canvas.clientWidth, canvas.clientHeight, cappedDpr());
      applyHeld();
      onPithRef.current?.(renderer.pith());
      renderer.draw(clock.now());
    };

    resize();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    if (!observer) window.addEventListener('resize', resize);

    // Adaptive quality from the frame interval the browser actually gives us.
    let quality: 0 | 1 | 2 = 0;
    let lastNow = performance.now();
    let slow = 0;
    let fast = 0;
    const tick = (now: number) => {
      const interval = now - lastNow;
      lastNow = now;
      if (interval > SLOW_FRAME_MS) {
        slow++;
        fast = 0;
      } else if (interval < FAST_FRAME_MS) {
        fast++;
        slow = 0;
      } else {
        slow = 0;
        fast = 0;
      }
      if (slow >= SLOW_FRAMES_TO_DROP && quality < 2) {
        quality = quality === 0 ? 1 : 2;
        slow = 0;
        renderer.setQuality(quality);
      } else if (fast >= FAST_FRAMES_TO_RAISE && quality > 0) {
        quality = quality === 2 ? 1 : 0;
        fast = 0;
        renderer.setQuality(quality);
      }
      renderer.draw(clock.tick(now));
    };
    const unsubscribe = reduced ? null : subscribeTick(tick);

    // The nearest ring glows under the pointer. The canvas sits under the
    // whole page, so the listener goes on the window and reads canvas
    // coordinates; a finger lights a ring while it touches.
    const rect = () => canvas.getBoundingClientRect();
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = rect();
      renderer.setPointer({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const onPointerDown = (e: PointerEvent) => {
      const r = rect();
      renderer.setPointer({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') renderer.setPointer(null);
    };
    const onLeave = () => renderer.setPointer(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    document.documentElement.addEventListener('pointerleave', onLeave);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      unsubscribe?.();
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setHeld(held === null ? null : renderer.ringAt(held));
  }, [held]);

  // Option changes update the live renderer in place, so the wobble is not reset.
  useEffect(() => {
    if (options) rendererRef.current?.setOptions(options);
  }, [options]);

  return <canvas ref={ref} className={className} />;
};
