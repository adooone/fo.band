import type { PageId } from './forest-renderer';

const NAME = 'Forest Orchestra';

/**
 * The band's name at the top of the home page, centred, on one line,
 * in a brush hand (Caveat Brush), bolder than the serif of the titles. It fades out inside a
 * section, where that corner holds the section's own title instead.
 */
export const BandName = ({ page }: { page: PageId }) => {
  const home = page === 'home';
  return (
    <div
      className="pointer-events-none absolute inset-x-0 text-center text-ink transition-opacity duration-500"
      style={{
        top: 'max(calc(48 * var(--k)), calc(env(safe-area-inset-top) + 16px))',
        opacity: home ? 1 : 0,
        transitionDelay: home ? '0.5s' : '0s',
      }}
      aria-hidden={!home}
    >
      <span
        className="block whitespace-nowrap font-brush"
        style={{
          fontSize: 'clamp(20px, calc(34 * var(--k)), 42px)',
          lineHeight: 1,
          letterSpacing: '0.01em',
        }}
      >
        {NAME}
      </span>
    </div>
  );
};
