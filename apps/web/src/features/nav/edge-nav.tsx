import { Link, useRouterState } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { type Edge, HOME_LABEL, SECTIONS, sectionOf } from './links';

type EdgeLinkProps = {
  to: string;
  label: string;
  edge: Edge;
  /** paper on the ink ground, ink in the paper sky. */
  tone: 'ink' | 'paper';
  /** Standing in the row under the band name, not on an edge of the screen. */
  row?: boolean;
  onHover?: (hot: boolean) => void;
};

/** A soft hand-drawn arrow, pointing toward the edge it leads off. */
const Arrow = ({ edge }: { edge: Edge }) => {
  const turn = { right: 0, bottom: 90, left: 180, top: 270 }[edge];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 20"
      className="block h-[0.7em] w-[1.4em] overflow-visible"
      style={{ transform: `rotate(${turn}deg)` }}
    >
      <path
        d="M2 11 C 12 8, 24 12, 36 10 M28 3 C 31 6, 34 8, 37 10 C 34 12, 31 14, 28 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const PLACE: Record<Edge, CSSProperties> = {
  right: { right: 'calc(36 * var(--kc))', top: '50%' },
  left: { left: 'calc(36 * var(--kc))', top: '50%' },
  bottom: {
    left: '50%',
    bottom: 'max(calc(34 * var(--kc)), env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
  },
  // Only the about page leads up: on the right of its thin strip of sky.
  top: {
    right: 'calc(36 * var(--kc))',
    top: 'max(8.5%, calc(env(safe-area-inset-top) + 12px))',
    transform: 'translateY(-50%)',
  },
};

/**
 * Where the arrow waits beside the word, off the text's own box so showing
 * it moves nothing: past the word on the side it points to, or under it.
 */
const ARROW: Record<Edge, string> = {
  right:
    'left-full top-1/2 ml-[0.4em] -translate-y-1/2 group-hover:translate-x-1',
  left: 'right-full top-1/2 mr-[0.4em] -translate-y-1/2 group-hover:-translate-x-1',
  bottom:
    'top-full left-1/2 mt-[0.1em] -translate-x-1/2 group-hover:translate-y-1',
  top: 'bottom-full left-1/2 mb-[0.1em] -translate-x-1/2 group-hover:-translate-y-1',
};

/**
 * A way out: the word, and its arrow drawn only while the pointer or the
 * keyboard is on it.
 */
const EdgeLink = ({ to, label, edge, tone, row, onHover }: EdgeLinkProps) => (
  <Link
    to={to}
    className={`group block whitespace-nowrap font-text outline-none [animation:fade-in_0.5s_ease-out_0.55s_both] ${
      tone === 'ink' ? 'text-ink' : 'text-paper'
    } ${row ? 'relative' : 'absolute z-10'}`}
    style={{
      ...(row ? {} : PLACE[edge]),
      fontSize: 'clamp(17px, calc(27 * var(--kc)), 30px)',
      letterSpacing: '0.01em',
    }}
    onMouseEnter={() => onHover?.(true)}
    onMouseLeave={() => onHover?.(false)}
    onFocus={() => onHover?.(true)}
    onBlur={() => onHover?.(false)}
  >
    <span className="block opacity-85 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:underline">
      {label}
    </span>
    <span
      className={`absolute opacity-0 transition-[opacity,transform] duration-300 group-focus-visible:opacity-100 group-hover:opacity-100 ${ARROW[edge]}`}
    >
      <Arrow edge={edge} />
    </span>
  </Link>
);

type EdgeNavProps = {
  /** A link toward an edge is hovered: the forest can stir that way. */
  onHover?: (edge: Edge) => void;
};

/** The order of the paths in the row on the home page, left to right. */
const ROW: readonly Edge[] = ['left', 'bottom', 'right'];

/**
 * The ways out. At home they stand in one row under the band's name, over
 * the mark: finds, about, music. Inside a section, the way back to the
 * forest is on the side it was entered from.
 */
export const EdgeNav = ({ onHover }: EdgeNavProps) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = sectionOf(pathname);
  return (
    <nav aria-label="Paths">
      {section ? (
        <EdgeLink
          to="/"
          label={HOME_LABEL}
          edge={section.back}
          // On the finds page the way back sits on the trunk.
          tone={section.page === 'finds' ? 'paper' : 'ink'}
          onHover={(hot) => hot && onHover?.(section.back)}
        />
      ) : (
        <div
          className="absolute inset-x-0 z-10 flex justify-center"
          style={{
            top: 'calc(196 * var(--k))',
            fontSize: 'clamp(17px, calc(27 * var(--kc)), 30px)',
          }}
        >
          <div className="relative flex gap-[2.6em]">
            {ROW.map((edge) => {
              const s = SECTIONS.find((x) => x.edge === edge);
              if (!s) return null;
              return (
                <EdgeLink
                  key={s.to}
                  to={s.to}
                  label={s.label}
                  edge={s.edge}
                  tone="ink"
                  row
                  onHover={(hot) => hot && onHover?.(s.edge)}
                />
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};
