import type { PageId } from './forest-renderer';
import { PugetSound } from './puget-sound';

/** Where to listen and follow. */
const LISTEN = [
  { label: 'Bandcamp', href: 'https://bandcamp.com' },
  { label: 'Spotify', href: 'https://open.spotify.com' },
  { label: 'Instagram', href: 'https://www.instagram.com' },
] as const;

const YEAR = new Date().getFullYear();

/**
 * The foot of the home page, in paper on the ink ground: the copyright on
 * the left, Puget Sound in the middle, where to listen on the right. On a
 * phone they stack under the mark, centred: where to listen, then the
 * copyright. It fades out inside a section.
 */
export const HomeFooter = ({ page }: { page: PageId }) => {
  const home = page === 'home';
  return (
    <footer
      aria-hidden={!home}
      className={`absolute inset-x-0 flex flex-col items-center gap-[0.9em] font-text text-paper transition-opacity duration-500 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-0 ${
        home ? '' : 'pointer-events-none'
      }`}
      style={{
        bottom: 'max(calc(40 * var(--kc)), env(safe-area-inset-bottom))',
        paddingInline: 'calc(56 * var(--kc))',
        fontSize: 'clamp(13px, calc(18 * var(--kc)), 20px)',
        letterSpacing: '0.01em',
        opacity: home ? 1 : 0,
        transitionDelay: home ? '0.5s' : '0s',
      }}
    >
      <PugetSound className="w-[calc(140*var(--kc))] sm:col-start-2 sm:row-start-1" />
      <div className="flex flex-col-reverse items-center gap-[0.5em] sm:contents">
        <p className="whitespace-nowrap opacity-60 sm:col-start-1 sm:row-start-1 sm:justify-self-start sm:opacity-85">
          © {YEAR} Forest Orchestra
        </p>
        <nav
          aria-label="Listen"
          className="flex gap-[1.2em] sm:col-start-3 sm:row-start-1 sm:justify-self-end"
        >
          {LISTEN.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              tabIndex={home ? undefined : -1}
              className="opacity-85 outline-none transition-opacity duration-300 hover:opacity-100 focus-visible:underline"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
};
