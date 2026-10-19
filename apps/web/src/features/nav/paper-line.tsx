import { useEffect, useRef } from 'react';
import { createNoise2D } from 'simplex-noise';
import {
  cappedDpr,
  createClock,
  observeVisible,
  prefersReducedMotion,
  subscribeTick,
} from '@/lib/ticker';
import { mulberry32, PAPER } from '@/features/home/tree-rings-renderer';

/**
 * A hand-drawn paper hairline: the top edge of the phone nav, wobbling as
 * slowly as the rings. Shares the page's animation loop and stops while off
 * screen.
 */

const BAND = 1.1;
const AMPLITUDE = 1.6;
const WAVELENGTH = 260;
const FLOW = 14;

export const PaperLine = ({ className }: { className?: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const noise = createNoise2D(mulberry32(11));
    const reduced = prefersReducedMotion();
    const clock = createClock(reduced);
    let width = 0;
    let height = 0;

    const edgeAt = (x: number, t: number) => {
      const u = (x - t * FLOW) / WAVELENGTH;
      return (
        height / 2 +
        AMPLITUDE * (0.6 * noise(u, 1.5) + 0.8 * noise(u / 2.7, 8.5))
      );
    };

    const draw = (now: number) => {
      const t = clock.tick(now);
      ctx.clearRect(0, 0, width, height);
      const step = 3;
      ctx.fillStyle = PAPER;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      let first = true;
      for (let x = 0; x <= width + step; x += step) {
        const y = edgeAt(x, t);
        const w =
          (BAND / 2) * (1 + 0.35 * noise((x - t * FLOW * 0.4) / 400, 20));
        if (first) ctx.moveTo(x, y - w);
        else ctx.lineTo(x, y - w);
        first = false;
      }
      for (let x = width + step; x >= 0; x -= step) {
        const y = edgeAt(x, t);
        const w =
          (BAND / 2) * (1 + 0.35 * noise((x - t * FLOW * 0.4) / 400, 20));
        ctx.lineTo(x, y + w);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const dpr = cappedDpr();
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    };

    resize();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    if (!observer) window.addEventListener('resize', resize);

    let unsubscribe: (() => void) | null = null;
    const stopObserving = observeVisible(canvas, (visible) => {
      if (visible && !reduced && !unsubscribe)
        unsubscribe = subscribeTick(draw);
      if (!visible && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    });

    return () => {
      unsubscribe?.();
      stopObserving();
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className={className} />;
};
