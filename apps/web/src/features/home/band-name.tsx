import type { PageId } from './forest-renderer';

const NAME = 'Forest Orchestra';

/**
 * The band's name at the top of the home page, centred, on one line, in
 * the brush hand, at the same height and size as the music page's title so
 * the two read as one voice. It fades out inside a section.
 */
export const BandName = ({ page }: { page: PageId }) => {
  const home = page === 'home';
  return (
    <div
      className="pointer-events-none absolute inset-x-0 text-center text-ink transition-opacity duration-500"
      style={{
        top: 'calc(96 * var(--k))',
        opacity: home ? 1 : 0,
        transitionDelay: home ? '0.5s' : '0s',
      }}
      aria-hidden={!home}
    >
      <span
        className="block whitespace-nowrap font-brush"
        style={{
          fontSize: 'var(--title)',
          letterSpacing: '0.01em',
        }}
      >
        {NAME}
      </span>
    </div>
  );
};
