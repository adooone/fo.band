import { Outlet, useRouterState } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { EdgeNav, pageOf, sectionOf, useDirections } from '@/features/nav';
import { BandName } from './band-name';
import { Forest } from './forest';
import type { ForestLayout, ForestRenderer } from './forest-renderer';
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
 * clearing, all on one canvas under every route. The ways out sit on the
 * edges (music right, roots down, finds left) and the arrow keys and swipes
 * walk them too; the forest travels and changes form with the page. The
 * matched route's content renders on top. In dev (or with `?tune`) a
 * sidebar of sliders tunes it all live.
 */
export const HomeShell = () => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = sectionOf(pathname);
  const page = pageOf(pathname);
  useDirections();
  const forest = useRef<ForestRenderer | null>(null);
  const [layout, setLayout] = useState<ForestLayout | null>(null);
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
  // Hovering a way out sends a breeze from that side of the screen.
  const breeze = (edge: string) => {
    forest.current?.gust(edge === 'left' ? 1 : -1);
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
          page={page}
          apiRef={forest}
          onLayout={setLayout}
        />
        <BandName page={page} />
        <SkyTitle title={current?.label ?? null} page={page} />
        <Outlet />
        <EdgeNav onHover={breeze} ground={layout} />
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
