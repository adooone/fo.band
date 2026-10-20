export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export type SectionPath = '/music' | '/concerts' | '/about';

export type NavLink = {
  to: SectionPath;
  label: string;
  /** Where the link sits on the desktop home page. */
  corner: Corner;
};

export const NAV_LINKS: readonly NavLink[] = [
  { to: '/music', label: 'Музика', corner: 'tl' },
  { to: '/concerts', label: 'Концерти', corner: 'tr' },
  { to: '/about', label: 'Про нас', corner: 'bl' },
];
