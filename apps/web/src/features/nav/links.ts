import type { PageId } from '@/features/home/forest-renderer';

export type Edge = 'left' | 'right' | 'bottom' | 'top';
export type SectionPath = '/music' | '/about' | '/finds';

export type Section = {
  to: SectionPath;
  label: string;
  page: Exclude<PageId, 'home'>;
  /** The edge of the home page it leads off from. */
  edge: Exclude<Edge, 'top'>;
  /** The edge its way home sits on. */
  back: Edge;
};

/**
 * Three paths out of the forest: right to the music, down to the roots
 * (the band and its people), left to the finds (everyone's other work).
 */
export const SECTIONS: readonly Section[] = [
  { to: '/music', label: 'Music', page: 'music', edge: 'right', back: 'left' },
  {
    to: '/about',
    label: 'About',
    page: 'about',
    edge: 'bottom',
    back: 'top',
  },
  {
    to: '/finds',
    label: 'Finds',
    page: 'finds',
    edge: 'left',
    back: 'right',
  },
];

export const HOME_LABEL = 'Forest';

export const sectionOf = (pathname: string): Section | undefined =>
  SECTIONS.find((s) => s.to === pathname);

export const pageOf = (pathname: string): PageId =>
  sectionOf(pathname)?.page ?? 'home';

/** Where an arrow key or a swipe toward `edge` leads from a page. */
export const pathToward = (pathname: string, edge: Edge): string | null => {
  const section = sectionOf(pathname);
  if (section) return section.back === edge ? '/' : null;
  return SECTIONS.find((s) => s.edge === edge)?.to ?? null;
};
