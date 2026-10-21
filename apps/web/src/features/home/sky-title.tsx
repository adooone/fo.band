import type { PageId } from './forest-renderer';
import { useIntroStage } from './intro';

type SkyTitleProps = {
  title: string | null;
  page: PageId;
};

/**
 * A section's title, in the brush hand: high up in the middle on the music
 * and finds pages; on the about page in the thin strip of sky, on the left
 * of the mark.
 */
/** How long a section's title waits for its page's change to play out, seconds. */
export const TITLE_DELAY: Record<PageId, number> = {
  home: 0.5,
  music: 0.5,
  about: 1,
  finds: 1.8,
};

export const SkyTitle = ({ title, page }: SkyTitleProps) => {
  const strip = page === 'about';
  const stage = useIntroStage();
  const shown = Boolean(title) && stage >= 1;
  return (
    <div
      className={`pointer-events-none absolute flex text-ink transition-opacity duration-500 ${
        strip ? '' : 'inset-x-0 justify-center text-center'
      } ${
        // On a phone the art page stays dark: the title is paper there.
        page === 'finds' ? 'max-sm:text-paper' : ''
      }`}
      style={{
        ...(strip
          ? {
              left: 'calc(40 * var(--kc))',
              top: 'max(6%, calc(env(safe-area-inset-top) + 12px))',
              transform: 'translateY(-50%)',
            }
          : { top: 'calc(96 * var(--k))' }),
        opacity: shown ? 1 : 0,
        // It waits for its page: on about for the horizon to be drawn up,
        // on art for the trunk to clear the field.
        transitionDelay: title ? `${TITLE_DELAY[page]}s` : '0s',
      }}
      aria-hidden="true"
    >
      <span
        className="block font-brush"
        style={{
          fontSize: strip
            ? 'clamp(30px, calc(44 * var(--k)), 54px)'
            : 'var(--title)',
          letterSpacing: '0.01em',
        }}
      >
        {title}
      </span>
    </div>
  );
};
