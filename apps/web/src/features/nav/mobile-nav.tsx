import { Link, useRouterState } from '@tanstack/react-router';
import { NAV_LINKS, type SectionPath } from './links';

type MobileNavProps = {
  onPress: (to: SectionPath) => void;
};

/**
 * Bottom navigation for portrait screens, standing on the forest floor in
 * paper; the desktop uses the corner links.
 */
export const MobileNav = ({ onPress }: MobileNavProps) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Розділи"
      className="fixed inset-x-0 bottom-0 z-10 hidden portrait:block"
    >
      <div
        className="flex items-center justify-center gap-7 px-4 font-serif font-medium text-paper"
        style={{
          paddingBottom: 'max(18px, env(safe-area-inset-bottom))',
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
              onPointerDown={() => onPress(link.to)}
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
