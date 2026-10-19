export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export type SectionPath = '/music' | '/concerts' | '/about';

export type NavLink = {
  to: SectionPath;
  label: string;
  /** Where the link sits on the desktop home page. */
  corner: Corner;
  /** The ring that lights for this section, as a fraction of the trunk's radius. */
  ring: number;
};

export const NAV_LINKS: readonly NavLink[] = [
  { to: '/music', label: 'Музика', corner: 'tl', ring: 0.36 },
  { to: '/concerts', label: 'Концерти', corner: 'tr', ring: 0.62 },
  { to: '/about', label: 'Про нас', corner: 'bl', ring: 0.86 },
];

/** Route → ring fraction, for the shell. */
export const SECTION_RINGS: Partial<Record<string, number>> =
  Object.fromEntries(NAV_LINKS.map((link) => [link.to, link.ring]));
