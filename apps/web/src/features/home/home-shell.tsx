import { Outlet, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { MobileNav, NAV_LINKS, SECTION_RINGS } from '@/features/nav';
import { CornerLink } from './corner-link';
import { Heart } from './heart';
import { TreeRings } from './tree-rings';

const TITLE = 'Лісовий Оркестр';

/**
 * The living frame: one canvas under every route, the name in the heart of
 * the trunk, the corner links and the bottom nav. The matched route's
 * content renders on top.
 */
export const HomeShell = () => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV_LINKS.find((link) => link.to === pathname);
  const [hovered, setHovered] = useState<string | null>(null);
  // The lit ring: the hovered link's, else the open section's.
  const litPath = hovered ?? current?.to ?? null;
  const held = litPath === null ? null : (SECTION_RINGS[litPath] ?? null);
  const [pith, setPith] = useState<{ x: number; y: number } | null>(null);

  return (
    <main className="home relative h-dvh w-full overflow-hidden bg-ink text-paper">
      <TreeRings
        className="absolute inset-0 block h-full w-full"
        held={held}
        onPith={setPith}
      />
      <Heart
        title={current?.label ?? TITLE}
        section={current !== undefined}
        at={pith}
      />
      <Outlet />
      {NAV_LINKS.map((link) => (
        <CornerLink
          key={link.to}
          corner={link.corner}
          to={link.to}
          label={link.label}
          active={pathname === link.to}
          onHover={(hot) => setHovered(hot ? link.to : null)}
        />
      ))}
      {/* A quiet mark in the free corner. */}
      <span
        aria-hidden="true"
        className="absolute font-sans text-paper opacity-50 portrait:hidden"
        style={{
          right: 'calc(44 * var(--kc))',
          bottom: 'calc(40 * var(--kc))',
          fontSize: 'calc(14 * var(--kc))',
          letterSpacing: '0.2em',
        }}
      >
        fo.band
      </span>
      <MobileNav onHover={setHovered} />
    </main>
  );
};
