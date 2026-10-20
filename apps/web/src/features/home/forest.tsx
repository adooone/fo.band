import { type RefObject, useEffect, useRef } from 'react';
import {
  cappedDpr,
  createClock,
  prefersReducedMotion,
  subscribeTick,
} from '@/lib/ticker';
import {
  type ForestLayout,
  type ForestOptions,
  type ForestRenderer,
  type MarkOptions,
  createForestRenderer,
} from './forest-renderer';

type ForestProps = {
  className?: string;
  options: ForestOptions;
  mark: MarkOptions;
  /** The live renderer, for the mark to read the wind and the shell to send gusts. */
  apiRef: RefObject<ForestRenderer | null>;
  onLayout?: (layout: ForestLayout) => void;
};

/** The forest on a canvas, on the page's shared animation loop. */
export const Forest = ({
  className,
  options,
  mark,
  apiRef,
  onLayout,
}: ForestProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef(options);
  const markRef = useRef(mark);
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

    const reduced = prefersReducedMotion();
    const clock = createClock(reduced);

    const resize = () => {
      renderer.resize(canvas.clientWidth, canvas.clientHeight, cappedDpr());
      // With motion reduced the forest stands fully grown from the first frame.
      renderer.draw(reduced ? 10 : clock.now());
    };
    resize();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    if (!observer) window.addEventListener('resize', resize);

    const unsubscribe = reduced
      ? null
      : subscribeTick((now) => renderer.draw(clock.tick(now)));

    return () => {
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
    markRef.current = mark;
    apiRef.current?.setMark(mark);
  }, [mark, apiRef]);

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label="Ліс і знак fo"
    />
  );
};
