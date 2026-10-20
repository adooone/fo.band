import { Link } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import type { Corner, SectionPath } from '@/features/nav/links';

const EDGES: Record<Corner, { x: 'left' | 'right'; y: 'top' | 'bottom' }> = {
  tl: { x: 'left', y: 'top' },
  tr: { x: 'right', y: 'top' },
  bl: { x: 'left', y: 'bottom' },
  br: { x: 'right', y: 'bottom' },
};

// --kc is one design pixel for the corners (a length), so multiply by a plain number.
const px = (value: number) => `calc(${value} * var(--kc))`;

type CornerLinkProps = {
  corner: Corner;
  label: string;
  to: SectionPath;
  /** The open section: underlined, and leads home. */
  active: boolean;
  onHover: (hot: boolean) => void;
};

/**
 * A calm, upright label in a corner: ink in the sky, paper on the ground.
 * Hovering it sends a breeze through the forest (through `onHover`) and
 * draws a hairline under the word.
 */
export const CornerLink = ({
  corner,
  label,
  to,
  active,
  onHover,
}: CornerLinkProps) => {
  const edge = EDGES[corner];
  const tone = edge.y === 'top' ? 'text-ink' : 'text-paper';
  const line = edge.y === 'top' ? 'bg-ink' : 'bg-paper';
  const style: CSSProperties = {
    [edge.x]: px(44),
    [edge.y]: px(40),
    fontSize: px(22),
    letterSpacing: '0.08em',
  };
  return (
    <Link
      to={active ? '/' : to}
      aria-current={active ? 'page' : undefined}
      className={`group absolute block whitespace-nowrap font-serif font-medium outline-none portrait:hidden ${tone}`}
      style={style}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      <span className="block opacity-80 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`mt-[0.35em] block h-px opacity-80 transition-[width] duration-700 ease-out ${line}`}
        style={{
          width: active ? '100%' : '0%',
          marginLeft: edge.x === 'right' ? 'auto' : undefined,
        }}
      />
      <span
        aria-hidden="true"
        className={`block h-px -translate-y-px opacity-60 transition-[width] duration-700 ease-out group-hover:w-full group-focus-visible:w-full ${line}`}
        style={{
          width: '0%',
          marginLeft: edge.x === 'right' ? 'auto' : undefined,
        }}
      />
    </Link>
  );
};
