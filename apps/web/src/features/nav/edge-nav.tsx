import { Link, useRouterState } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import type { ForestLayout } from '@/features/home/forest-renderer';
import { type Edge, HOME_LABEL, SECTIONS, sectionOf } from './links';

type EdgeLinkProps = {
  to: string;
  label: string;
  edge: Edge;
  /** paper on the ink ground, ink in the paper sky. */
  tone: 'ink' | 'paper';
  /** Stand here (as a centred point) instead of on the edge. */
  place?: CSSProperties;
  onHover?: (hot: boolean) => void;
};

/** A soft hand-drawn arrow, pointing toward the edge it leads off. */
const Arrow = ({ edge }: { edge: Edge }) => {
  const turn = { right: 0, bottom: 90, left: 180, top: 270 }[edge];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 20"
      className="block h-[0.7em] w-[1.4em] overflow-visible transition-transform duration-500 group-hover:translate-x-1"
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
  // Only the roots page leads up: on the right of its thin strip of sky.
  top: {
    right: 'calc(36 * var(--kc))',
    top: 'max(8.5%, calc(env(safe-area-inset-top) + 12px))',
    transform: 'translateY(-50%)',
  },
};

const EdgeLink = ({ to, label, edge, tone, place, onHover }: EdgeLinkProps) => {
  const vertical = edge === 'bottom' && !place;
  return (
    <Link
      to={to}
      className={`group absolute z-10 flex items-center gap-[0.4em] whitespace-nowrap font-brush outline-none [animation:fade-in_0.5s_ease-out_0.55s_both] ${
        tone === 'ink' ? 'text-ink' : 'text-paper'
      } ${vertical ? 'flex-col' : ''} ${edge === 'left' ? 'flex-row-reverse' : ''}`}
      style={{
        ...(place ?? PLACE[edge]),
        fontSize: 'clamp(17px, calc(27 * var(--kc)), 30px)',
        letterSpacing: '0.01em',
      }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
    >
      <span className="block opacity-85 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:underline">
        {label}
      </span>
      <Arrow edge={edge} />
    </Link>
  );
};

type EdgeNavProps = {
  /** A link toward an edge is hovered: the forest can stir that way. */
  onHover?: (edge: Edge) => void;
  /** The forest's layout, to set the row of paths just under the hill. */
  ground?: ForestLayout | null;
};

/** The order of the paths in the row on the home page, left to right. */
const ROW: readonly Edge[] = ['left', 'bottom', 'right'];

/**
 * Where each path of the row stands on the home page: spread under the
 * mark, each word a little way into the ground at its own height and
 * turned along the slope of the land right under it, so the row follows
 * the hill like writing on a hillside.
 */
const onHill = (
  ground: ForestLayout | null | undefined,
  slot: -1 | 0 | 1,
): CSSProperties => {
  if (!ground) {
    return {
      left: `${50 + slot * 16}%`,
      top: '78%',
      transform: 'translate(-50%, -50%)',
    };
  }
  const { width, height, groundY } = ground;
  const spacing = Math.max(96, Math.min(175, 0.13 * width));
  const x = width / 2 + slot * spacing;
  const reach = Math.min(70, spacing * 0.6);
  const slope = (groundY(x + reach) - groundY(x - reach)) / (2 * reach);
  const angle = (Math.atan(slope) * 180) / Math.PI;
  return {
    left: x,
    top: groundY(x) + Math.max(36, 0.065 * height),
    transform: `translate(-50%, -50%) rotate(${angle.toFixed(2)}deg)`,
  };
};

/**
 * The ways out. At home they sit in one row on the ground just under the
 * mark, each with its arrow: finds to the left, roots down, music to the
 * right. Inside a section, the way back to the forest is on the side it
 * was entered from.
 */
export const EdgeNav = ({ onHover, ground }: EdgeNavProps) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = sectionOf(pathname);
  return (
    <nav aria-label="Paths">
      {section ? (
        <EdgeLink
          to="/"
          label={HOME_LABEL}
          edge={section.back}
          // On the finds page the way back sits on the strip of land.
          tone={section.page === 'finds' ? 'paper' : 'ink'}
          onHover={(hot) => hot && onHover?.(section.back)}
        />
      ) : (
        ROW.map((edge, i) => {
          const s = SECTIONS.find((x) => x.edge === edge);
          if (!s) return null;
          return (
            <EdgeLink
              key={s.to}
              to={s.to}
              label={s.label}
              edge={s.edge}
              tone="paper"
              place={onHill(ground, (i - 1) as -1 | 0 | 1)}
              onHover={(hot) => hot && onHover?.(s.edge)}
            />
          );
        })
      )}
    </nav>
  );
};
