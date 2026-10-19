import { Link, useRouterState } from '@tanstack/react-router';
import { NAV_LINKS } from './links';
import { PaperLine } from './paper-line';

type MobileNavProps = {
  onHover: (to: string | null) => void;
};

/** Bottom navigation for portrait screens; the desktop uses the corner links. */
export const MobileNav = ({ onHover }: MobileNavProps) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Розділи"
      className="fixed inset-x-0 bottom-0 z-10 hidden bg-ink portrait:block"
    >
      <PaperLine className="block h-3 w-full" />
      <div
        className="flex items-center justify-center gap-7 px-4 pt-2 font-serif font-medium text-paper"
        style={{
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          fontSize: 'clamp(14px, 4vw, 17px)',
          letterSpacing: '0.06em',
        }}
      >
        {NAV_LINKS.map((link) => {
          const active = pathname === link.to;
          return (
            <Link
              key={link.to}
              to={active ? '/' : link.to}
              aria-current={active ? 'page' : undefined}
              className="relative block whitespace-nowrap py-3 transition-opacity duration-500"
              style={{ opacity: active ? 1 : 0.8 }}
              onPointerDown={() => onHover(link.to)}
              onPointerUp={() => onHover(null)}
              onPointerCancel={() => onHover(null)}
            >
              {link.label}
              <span
                aria-hidden="true"
                className="absolute bottom-1.5 left-0 block h-px bg-paper transition-[width] duration-700 ease-out"
                style={{ width: active ? '100%' : '0%' }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
