import { Outlet, useRouterState } from '@tanstack/react-router';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { EdgeNav, pageOf, sectionOf, useDirections } from '@/features/nav';
import { prefersReducedMotion } from '@/lib/ticker';
import { BandName } from './band-name';
import { Forest } from './forest';
import {
  DEFAULT_MARK,
  DEFAULT_OPTIONS,
  type ForestRenderer,
  INK,
  PAPER,
  type PageId,
} from './forest-renderer';
import { HomeFooter } from './home-footer';
import { InkPicker, inkPickerWanted, loadInk } from './ink-picker';
import { IntroContext, useIntro } from './intro';
import { SkyTitle } from './sky-title';

type Edge = 'paper' | 'ink' | null;

/**
 * The colours of the page's top and bottom edges, for the thin strips
 * Safari tints its own bars from (it samples a fixed element hugging an
 * edge, else the page's background, and ignores `theme-color` since 26):
 * paper sky on top and ink land below; on the art page no strip below, as
 * its white field meets the bottom, and on a phone, where that page stays
 * all ink, ink at both. The colours switch at once, never in a transition
 * (Safari keeps whatever it sampled halfway through), once the dive has
 * filled the screen on the way in and once it has cleared on the way out.
 */
const useEdges = (page: PageId, ink = INK) => {
  const [edges, setEdges] = useState<{ top: Edge; bottom: Edge }>({
    top: 'paper',
    bottom: 'ink',
  });
  const wasArt = useRef(false);
  useEffect(() => {
    const art = page === 'finds';
    const phone =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 639px)')
        : null;
    let timer = 0;
    const apply = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const dark = art && Boolean(phone?.matches);
        setEdges(
          dark
            ? { top: 'ink', bottom: 'ink' }
            : { top: 'paper', bottom: art ? null : 'ink' },
        );
        document.documentElement.classList.toggle('art-dark', dark);
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute('content', dark ? ink : PAPER);
      }, delay);
    };
    apply(art ? 1200 : wasArt.current ? 900 : 0);
    wasArt.current = art;
    const onChange = () => apply(0);
    phone?.addEventListener('change', onChange);
    return () => {
      window.clearTimeout(timer);
      phone?.removeEventListener('change', onChange);
    };
  }, [page, ink]);
  return edges;
};

/** A thin strip fixed on an edge, in that edge's colour, or none. */
const EdgeStrip = ({ at, colour }: { at: 'top' | 'bottom'; colour: Edge }) =>
  colour ? (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 h-3 ${
        at === 'top' ? 'top-0' : 'bottom-0'
      } ${colour === 'ink' ? 'bg-ink' : 'bg-paper'}`}
    />
  ) : null;

/**
 * The living frame: paper sky, ink forest and the mark growing out of the
 * clearing, all on one canvas under every route. The ways out sit in a row
 * under the band's name and the arrow keys and swipes walk them too; the
 * forest travels and changes form with the page. The matched route's
 * content renders on top. In dev (or with `?tune`) a swatch picks the ink.
 */
export const HomeShell = () => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = sectionOf(pathname);
  const page = pageOf(pathname);
  useDirections();
  const forest = useRef<ForestRenderer | null>(null);
  const picker = inkPickerWanted();
  const [ink, setInk] = useState(() => (picker ? loadInk() : undefined));
  const edges = useEdges(page, ink);
  const [firstPage] = useState(page);
  const [reduced] = useState(prefersReducedMotion);
  const stage = useIntro(firstPage, reduced);

  return (
    <IntroContext.Provider value={stage}>
      <main
        className="home relative h-dvh overflow-hidden bg-paper text-ink"
        style={ink ? ({ '--color-ink': ink } as CSSProperties) : undefined}
      >
        <Forest
          className="absolute inset-0 block h-full w-full"
          options={DEFAULT_OPTIONS}
          mark={DEFAULT_MARK}
          ink={ink}
          page={page}
          apiRef={forest}
        />
        <BandName page={page} />
        <HomeFooter page={page} />
        <SkyTitle title={current?.label ?? null} page={page} />
        <Outlet />
        <EdgeNav />
        <EdgeStrip at="top" colour={edges.top} />
        <EdgeStrip at="bottom" colour={edges.bottom} />
        {picker && ink && page === 'home' && stage >= 3 && (
          <InkPicker value={ink} onChange={setInk} />
        )}
      </main>
    </IntroContext.Provider>
  );
};
