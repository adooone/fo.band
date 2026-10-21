import { type RefObject, useEffect, useRef } from 'react';
import {
  cappedDpr,
  createClock,
  prefersReducedMotion,
  subscribeTick,
} from '@/lib/ticker';
import {
  createForestRenderer,
  type ForestLayout,
  type ForestOptions,
  type ForestRenderer,
  type MarkOptions,
  type PageId,
} from './forest-renderer';

type ForestProps = {
  className?: string;
  options: ForestOptions;
  mark: MarkOptions;
  /** The ink, a `#rrggbb` colour; the default when left out. */
  ink?: string;
  /** Which page the forest stands on; changes travel there. */
  page: PageId;
  /** The live renderer, for the mark to read the wind and the shell to send gusts. */
  apiRef: RefObject<ForestRenderer | null>;
  onLayout?: (layout: ForestLayout) => void;
};

/**
 * Frame pacing thresholds for adaptive quality, and the pixel-density
 * steps it walks down (fractions of the device's own).
 */
const SLOW_FRAME_MS = 22;
const FAST_FRAME_MS = 12;
const SLOW_FRAMES_TO_DROP = 45;
const FAST_FRAMES_TO_RAISE = 240;
const PIXEL_STEPS = [1, 0.75, 0.55] as const;

/** The forest on a canvas, on the page's shared animation loop. */
export const Forest = ({
  className,
  options,
  mark,
  ink,
  page,
  apiRef,
  onLayout,
}: ForestProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef(page);
  const optionsRef = useRef(options);
  const markRef = useRef(mark);
  const inkRef = useRef(ink);
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = createForestRenderer(
      canvas,
      optionsRef.current,
      markRef.current,
      (l) => onLayoutRef.current?.(l),
    );
    if (!renderer) return;
    apiRef.current = renderer;
    if (inkRef.current) renderer.setInk(inkRef.current);
    // Opening a section by its address starts there, without the journey.
    renderer.setPage(pageRef.current, true);

    const reduced = prefersReducedMotion();
    const clock = createClock(reduced);
    let quality = 0;

    const resize = () => {
      renderer.resize(
        canvas.clientWidth,
        canvas.clientHeight,
        cappedDpr() * PIXEL_STEPS[quality],
      );
      // With motion reduced the forest stands fully grown from the first frame.
      renderer.draw(reduced ? 20 : clock.now());
    };
    resize();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    if (!observer) window.addEventListener('resize', resize);

    // Adaptive quality from the frame interval the browser actually gives
    // us: sustained slow frames lower the pixel density, sustained fast
    // ones restore it. The picture itself never changes.
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
      if (slow >= SLOW_FRAMES_TO_DROP && quality < PIXEL_STEPS.length - 1) {
        quality++;
        slow = 0;
        renderer.setPixelRatio(cappedDpr() * PIXEL_STEPS[quality]);
      } else if (fast >= FAST_FRAMES_TO_RAISE && quality > 0) {
        quality--;
        fast = 0;
        renderer.setPixelRatio(cappedDpr() * PIXEL_STEPS[quality]);
      }
      renderer.draw(clock.tick(now));
    };
    const unsubscribe = reduced ? null : subscribeTick(tick);

    // The home page looks past the forest with the pointer: a mouse or a
    // pen, not a finger, and not with motion reduced.
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      renderer.setPointer(
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      );
    };
    const onLeave = () => renderer.setPointer(0, 0);
    if (!reduced) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('mouseleave', onLeave);
    }

    return () => {
      if (!reduced) {
        window.removeEventListener('pointermove', onMove);
        document.documentElement.removeEventListener('mouseleave', onLeave);
      }
      unsubscribe?.();
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
      apiRef.current = null;
    };
  }, [apiRef]);

  // Option changes update the live renderer in place, so the motion is not reset.
  useEffect(() => {
    optionsRef.current = options;
    apiRef.current?.setOptions(options);
  }, [options, apiRef]);
  useEffect(() => {
    pageRef.current = page;
    apiRef.current?.setPage(page);
  }, [page, apiRef]);
  useEffect(() => {
    markRef.current = mark;
    apiRef.current?.setMark(mark);
  }, [mark, apiRef]);
  useEffect(() => {
    inkRef.current = ink;
    if (ink) apiRef.current?.setInk(ink);
  }, [ink, apiRef]);

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label="The forest and the fo mark"
    />
  );
};
