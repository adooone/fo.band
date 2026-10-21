import { Link, useRouterState } from '@tanstack/react-router';
import type { CSSProperties, ReactNode } from 'react';
import { useIntroStage } from '@/features/home/intro';
import { TITLE_DELAY } from '@/features/home/sky-title';
import { type Edge, HOME_LABEL, SECTIONS, sectionOf } from './links';

type EdgeLinkProps = {
  to: string;
  label: string;
  edge: Edge;
  /**
   * paper on the ink ground, ink in the paper sky; `art` is ink over the
   * art page's white field, but paper on a phone, where that page stays dark.
   */
  tone: 'ink' | 'paper' | 'art';
  /** Standing in the row under the band name, not on an edge of the screen. */
  row?: boolean;
  /** Seconds before it fades in. */
  delay?: number;
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
    top: 'max(6%, calc(env(safe-area-inset-top) + 12px))',
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
const EdgeLink = ({
  to,
  label,
  edge,
  tone,
  row,
  delay = 0.55,
  onHover,
}: EdgeLinkProps) => (
  <Link
    to={to}
    className={`group block whitespace-nowrap font-text outline-none [animation:fade-in_0.5s_ease-out_both] ${
      tone === 'ink'
        ? 'text-ink'
        : tone === 'art'
          ? 'text-ink max-sm:text-paper'
          : 'text-paper'
    } ${row ? 'relative' : 'absolute z-10'}`}
    style={{
      ...(row ? {} : PLACE[edge]),
      animationDelay: `${delay}s`,
      fontSize: 'var(--path)',
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

/** The row under the title, centred, where the home page's paths stand. */
const Row = ({ children }: { children: ReactNode }) => (
  <div
    className="absolute inset-x-0 z-10 flex justify-center"
    style={{
      top: 'var(--row)',
      fontSize: 'var(--path)',
    }}
  >
    <div className="relative flex gap-[1.6em]">{children}</div>
  </div>
);

/**
 * The ways out. At home they stand in one row under the band's name, over
 * the mark: music, about, finds. On the music and finds pages the way home
 * stands in the same row under the title; on about it is on the side the
 * page was entered from.
 */
export const EdgeNav = ({ onHover }: EdgeNavProps) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = sectionOf(pathname);
  // On first load the paths wait their turn after the titles.
  const shown = useIntroStage() >= 2;
  const veil: CSSProperties = {
    opacity: shown ? 1 : 0,
    pointerEvents: shown ? undefined : 'none',
    transition: 'opacity 0.8s ease',
  };
  if (section) {
    const row = section.page === 'music' || section.page === 'finds';
    const home = (
      <EdgeLink
        to="/"
        label={HOME_LABEL}
        edge={section.back}
        tone={section.page === 'finds' ? 'art' : 'ink'}
        row={row}
        // The way home shows once the page's title has come.
        delay={TITLE_DELAY[section.page] + 0.4}
        onHover={(hot) => hot && onHover?.(section.back)}
      />
    );
    return (
      <nav aria-label="Paths" style={veil}>
        {row ? <Row>{home}</Row> : home}
      </nav>
    );
  }
  return (
    <nav aria-label="Paths" style={veil}>
      <Row>
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
      </Row>
    </nav>
  );
};
