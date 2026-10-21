/**
 * The faces the site can wear, for the titles (the band's name and the
 * section titles) and for everything else (the paths, future text). Every
 * one is self-hosted from `public/fonts`, declared in `styles/index.css`.
 */

export type FontId =
  | 'mansalva'
  | 'caveat'
  | 'luminari'
  | 'eagle-lake'
  | 'condiment'
  | 'caesar'
  | 'kyiv-serif'
  | 'kyiv-sans'
  | 'metro-roman'
  | 'metro-sport'
  | 'metro-xarkiv'
  | 'metro-botanical'
  | 'metro-blueline';

export type FontChoice = {
  fontTitles: FontId;
  fontText: FontId;
};

export const DEFAULT_FONTS: FontChoice = {
  fontTitles: 'luminari',
  fontText: 'mansalva',
};

export const FONTS: { id: FontId; label: string; family: string }[] = [
  { id: 'mansalva', label: 'Mansalva', family: '"Mansalva", cursive' },
  { id: 'caveat', label: 'Caveat Brush', family: '"Caveat Brush", cursive' },
  { id: 'luminari', label: 'Luminari', family: '"Luminari", serif' },
  { id: 'eagle-lake', label: 'Eagle Lake', family: '"Eagle Lake", cursive' },
  { id: 'condiment', label: 'Condiment', family: '"Condiment", cursive' },
  {
    id: 'caesar',
    label: 'Caesar Dressing',
    family: '"Caesar Dressing", cursive',
  },
  {
    id: 'kyiv-serif',
    label: 'KyivType Serif',
    family: '"KyivType Serif", serif',
  },
  {
    id: 'kyiv-sans',
    label: 'KyivType Sans',
    family: '"KyivType Sans", sans-serif',
  },
  {
    id: 'metro-roman',
    label: 'KTF Metro Roman',
    family: '"KTF Metro Roman", sans-serif',
  },
  {
    id: 'metro-sport',
    label: 'KTF Metro Sport',
    family: '"KTF Metro Sport", sans-serif',
  },
  {
    id: 'metro-xarkiv',
    label: 'KTF Metro Xarkiv',
    family: '"KTF Metro Xarkiv", sans-serif',
  },
  {
    id: 'metro-botanical',
    label: 'KTF Metro Botanical',
    family: '"KTF Metro Botanical", sans-serif',
  },
  {
    id: 'metro-blueline',
    label: 'KTF Metro Blueline',
    family: '"KTF Metro Blueline", sans-serif',
  },
];

/** The CSS font-family for a face, the default's if the id is unknown. */
export const fontFamily = (id: FontId): string =>
  (FONTS.find((f) => f.id === id) ?? FONTS[0]).family;
