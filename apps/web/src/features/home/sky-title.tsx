import type { PageId } from './forest-renderer';

type SkyTitleProps = {
  title: string | null;
  page: PageId;
};

/**
 * A section's title, in the brush hand: high in the sky on the music page; on the about page
 * in the thin strip of sky, on the left of the mark; on the finds page at
 * the top of the white field, where the trunk's branch reaches.
 */
export const SkyTitle = ({ title, page }: SkyTitleProps) => {
  const strip = page === 'about';
  const field = page === 'finds';
  return (
    <div
      className={`pointer-events-none absolute flex text-ink transition-opacity duration-500 ${
        strip || field ? '' : 'inset-x-0 justify-center text-center'
      }`}
      style={{
        ...(strip
          ? {
              left: 'calc(40 * var(--kc))',
              top: 'max(8.5%, calc(env(safe-area-inset-top) + 12px))',
              transform: 'translateY(-50%)',
            }
          : field
            ? { left: 'calc(56 * var(--kc))', top: 'calc(96 * var(--k))' }
            : { top: 'calc(96 * var(--k))' }),
        opacity: title ? 1 : 0,
        // On finds the title waits for the branch to reach it.
        transitionDelay: title ? (field ? '1.4s' : '0.5s') : '0s',
      }}
      aria-hidden="true"
    >
      <span
        className="block font-brush"
        style={{
          fontSize: strip
            ? 'clamp(24px, calc(44 * var(--k)), 54px)'
            : 'clamp(30px, calc(60 * var(--k)), 76px)',
          letterSpacing: '0.01em',
        }}
      >
        {title}
      </span>
    </div>
  );
};
