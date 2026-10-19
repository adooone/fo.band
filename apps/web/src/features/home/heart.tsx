import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { createClock, prefersReducedMotion, subscribeTick } from '@/lib/ticker';

/** One slow breath: in for half the period, out for the other half. */
const BREATH_SECONDS = 4.5;
const BREATH_DEPTH = 0.016;

type HeartProps = {
  /** The band's name at home, the section's title inside a section. */
  title: string;
  /** Inside a section: a way home under the title. */
  section: boolean;
  /** The pith, in CSS px; the name grows from it. Centred until known. */
  at: { x: number; y: number } | null;
};

/**
 * The heart of the trunk: the name, breathing very slowly. The scale comes
 * from the page's shared loop and clamped clock, like the rings, so a long
 * sleep never makes it gasp.
 */
export const Heart = ({ title, section, at }: HeartProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const clock = createClock();
    return subscribeTick((now) => {
      const t = clock.tick(now);
      // Smoother than a sine: holds a moment at the top and bottom of the breath.
      const phase = 0.5 - 0.5 * Math.cos((t / BREATH_SECONDS) * Math.PI * 2);
      const eased = phase * phase * (3 - 2 * phase);
      el.style.transform = `scale(${1 + BREATH_DEPTH * eased})`;
    });
  }, []);

  const [first, ...rest] = title.split(' ');

  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{
        left: at ? `${at.x}px` : '50%',
        top: at ? `${at.y}px` : '50%',
      }}
      aria-hidden="true"
    >
      <div
        ref={ref}
        className="flex flex-col items-center text-center text-paper will-change-transform"
        style={{
          fontSize: 'clamp(30px, calc(74 * var(--k)), 96px)',
          // Room between the lines for the pith to beat in.
          lineHeight: 1.16,
          letterSpacing: '0.04em',
          fontWeight: 300,
          transform: 'scale(1)',
        }}
      >
        <span className="block">{first}</span>
        {rest.length > 0 && <span className="block">{rest.join(' ')}</span>}
        <Link
          to="/"
          tabIndex={section ? 0 : -1}
          className="pointer-events-auto mt-[1.1em] block font-sans text-[0.19em] uppercase tracking-[0.3em] opacity-70 transition-opacity duration-500 hover:opacity-100"
          style={{
            opacity: section ? undefined : 0,
            pointerEvents: section ? undefined : 'none',
            transitionDelay: section ? '0.4s' : '0s',
          }}
        >
          додому
        </Link>
      </div>
    </div>
  );
};
