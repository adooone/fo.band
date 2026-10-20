import { Outlet, useRouterState } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { MobileNav, NAV_LINKS } from '@/features/nav';
import { CornerLink } from './corner-link';
import { Forest } from './forest';
import type { ForestRenderer } from './forest-renderer';
import { SkyTitle } from './sky-title';
import {
  loadTunerOpen,
  loadTuning,
  saveTunerOpen,
  TUNER_WIDTH,
  Tuner,
  type Tuning,
  tuningWanted,
} from './tuner';

/**
 * The living frame: paper sky, ink forest and the mark growing out of the
 * clearing, all on one canvas under every route, plus the corner links and the
 * bottom nav. The matched route's content renders on top. In dev (or with
 * `?tune`) a panel of sliders along the bottom tunes it all live.
 */
export const HomeShell = () => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV_LINKS.find((link) => link.to === pathname);
  const forest = useRef<ForestRenderer | null>(null);
  const [tuning, setTuning] = useState<Tuning>(loadTuning);
  const tuner = tuningWanted();
  const [tunerOpen, setTunerOpen] = useState(() => tuner && loadTunerOpen());
  const toggleTuner = () => {
    saveTunerOpen(!tunerOpen);
    setTunerOpen(!tunerOpen);
  };
  // On wider screens the page steps aside for the open sidebar; on phones
  // the sidebar slides over it.
  const pageWidth = tunerOpen ? `max(100% - ${TUNER_WIDTH}, 60%)` : '100%';
  const mark = useMemo(
    () => ({
      logo: tuning.logo,
      oLift: tuning.oLift,
      oShift: tuning.oShift,
      oScale: tuning.oScale,
      markWobble: tuning.markWobble,
      markBreath: tuning.markBreath,
      sproutSeconds: tuning.sproutSeconds,
      coil: tuning.coil,
    }),
    [
      tuning.logo,
      tuning.oLift,
      tuning.oShift,
      tuning.oScale,
      tuning.markWobble,
      tuning.markBreath,
      tuning.sproutSeconds,
      tuning.coil,
    ],
  );
  // Hovering a link sends a breeze from that link's side of the screen.
  const breeze = (corner: string) => (hot: boolean) => {
    if (hot) forest.current?.gust(corner.endsWith('l') ? 1 : -1);
  };

  return (
    <>
      <main
        className="home relative h-dvh overflow-hidden bg-paper text-ink"
        style={{ width: pageWidth }}
      >
        <Forest
          className="absolute inset-0 block h-full w-full"
          options={tuning}
          mark={mark}
          apiRef={forest}
        />
        <SkyTitle title={current?.label ?? null} />
        <Outlet />
        {NAV_LINKS.map((link) => (
          <CornerLink
            key={link.to}
            corner={link.corner}
            to={link.to}
            label={link.label}
            active={pathname === link.to}
            onHover={breeze(link.corner)}
          />
        ))}
        {/* A quiet mark in the free corner, on the ground. */}
        <span
          aria-hidden="true"
          className="absolute font-sans text-paper opacity-60 portrait:hidden"
          style={{
            right: 'calc(44 * var(--kc))',
            bottom: 'calc(40 * var(--kc))',
            fontSize: 'calc(14 * var(--kc))',
            letterSpacing: '0.2em',
          }}
        >
          fo.band
        </span>
        <MobileNav
          onPress={(to) => forest.current?.gust(to === '/music' ? 1 : -1)}
        />
      </main>
      {tuner && (
        <Tuner
          value={tuning}
          onChange={setTuning}
          onReplay={() => forest.current?.restart()}
          open={tunerOpen}
          onToggle={toggleTuner}
        />
      )}
    </>
  );
};
