import { Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
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
import { IntroContext, useIntro } from './intro';
import { SkyTitle } from './sky-title';

type Edge = 'paper' | 'ink' | null;

/**
 * The colours of the page's top and bottom edges, for the thin strips
 * Safari tints its own bars from (it samples a fixed element hugging an
 * edge, else the page's background, and ignores `theme-color` since 26):
 * paper sky on top and ink land below; on the art page no strips, as its
 * white field meets the bottom and the trunk's ink the top left, and on a
 * phone, where that page stays all ink, ink at both. The colours switch at once, never in a transition
 * (Safari keeps whatever it sampled halfway through): on a phone once the
 * dive has filled the screen on the way in, elsewhere at once, and once it
 * has cleared on the way out.
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
        // On the art page the top is ink on the left (the trunk) and
        // paper on the right: no strip fits, so none.
        setEdges(
          dark
            ? { top: 'ink', bottom: 'ink' }
            : { top: art ? null : 'paper', bottom: art ? null : 'ink' },
        );
        document.documentElement.classList.toggle('art-dark', dark);
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute('content', dark ? ink : PAPER);
      }, delay);
    };
    // Into art on a desktop the strips go at once, before the dive fills
    // the screen (a paper strip would lie over the ink); on a phone they
    // turn ink once it has. Out of art they come back only once the
    // curtain has closed and the camera has risen out of the land.
    apply(art ? (phone?.matches ? 1200 : 0) : wasArt.current ? 1900 : 0);
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
 * content renders on top.
 */
export const HomeShell = () => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = sectionOf(pathname);
  const page = pageOf(pathname);
  useDirections();
  const forest = useRef<ForestRenderer | null>(null);
  const edges = useEdges(page);
  const [firstPage] = useState(page);
  const [reduced] = useState(prefersReducedMotion);
  const stage = useIntro(firstPage, reduced);
  // Another forest on every visit: the trees, their places and the
  // mushrooms that grow in their stead all come from the seed.
  const [options] = useState(() => ({
    ...DEFAULT_OPTIONS,
    seed: 1 + Math.floor(Math.random() * 100000),
  }));

  return (
    <IntroContext.Provider value={stage}>
      <main className="home relative h-dvh overflow-hidden bg-paper text-ink">
        <Forest
          className="absolute inset-0 block h-full w-full"
          options={options}
          mark={DEFAULT_MARK}
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
      </main>
    </IntroContext.Provider>
  );
};
