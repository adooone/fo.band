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
  createForestRenderer,
} from './forest-renderer';

type ForestProps = {
  className?: string;
  options?: Partial<ForestOptions>;
  /** The live renderer, for the mark to read the wind and the shell to send gusts. */
  apiRef: RefObject<ForestRenderer | null>;
  onLayout?: (layout: ForestLayout) => void;
};

/** The forest on a canvas, on the page's shared animation loop. */
export const Forest = ({
  className,
  options,
  apiRef,
  onLayout,
}: ForestProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = createForestRenderer(canvas, optionsRef.current, (l) =>
      onLayoutRef.current?.(l),
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

  return <canvas ref={ref} className={className} />;
};
