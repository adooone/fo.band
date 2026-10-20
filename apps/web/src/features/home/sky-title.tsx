import { Link } from '@tanstack/react-router';

type SkyTitleProps = {
  title: string | null;
};

/** Inside a section: its title high in the sky, with the way home under it. */
export const SkyTitle = ({ title }: SkyTitleProps) => (
  <div
    className="pointer-events-none absolute inset-x-0 flex flex-col items-center text-center text-ink transition-opacity duration-700"
    style={{
      top: 'calc(96 * var(--k))',
      opacity: title ? 1 : 0,
      transitionDelay: title ? '0.3s' : '0s',
    }}
    aria-hidden={!title}
  >
    <span
      className="block font-serif font-light"
      style={{
        fontSize: 'clamp(28px, calc(56 * var(--k)), 72px)',
        letterSpacing: '0.04em',
      }}
    >
      {title}
    </span>
    <Link
      to="/"
      tabIndex={title ? 0 : -1}
      className="pointer-events-auto mt-4 block font-sans text-[13px] uppercase tracking-[0.3em] opacity-60 transition-opacity hover:opacity-100"
      style={{ pointerEvents: title ? undefined : 'none' }}
    >
      додому
    </Link>
  </div>
);
