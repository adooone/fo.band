import { createContext, useContext, useEffect, useState } from 'react';
import { introTextAt, type PageId } from './forest-renderer';

/**
 * How much of the text has come in on first load, in order: 1 the titles,
 * 2 the paths, 3 the foot of the page. Anything outside the shell sees it
 * all at once.
 */
export const IntroContext = createContext(3);

export const useIntroStage = () => useContext(IntroContext);

/** Seconds between one group of text coming in and the next. */
const STAGGER = 0.6;

/**
 * The text waits for the fonts and, on the home page, for the opening to
 * play out (the horizon drawn, the forest grown, the o up), then comes in
 * group by group. Opened straight into a section, or with motion reduced,
 * only the fonts are waited for.
 */
export const useIntro = (firstPage: PageId, reduced: boolean): number => {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const wait = firstPage === 'home' && !reduced ? introTextAt() : 0;
    const started = performance.now();
    const fonts =
      typeof document !== 'undefined' && document.fonts
        ? document.fonts.ready
        : Promise.resolve();
    fonts.then(() => {
      if (cancelled) return;
      const left = Math.max(0, wait - (performance.now() - started) / 1000);
      for (const step of [1, 2, 3]) {
        timers.push(
          window.setTimeout(
            () => setStage(step),
            (left + (step - 1) * STAGGER) * 1000,
          ),
        );
      }
    });
    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
    };
  }, [firstPage, reduced]);
  return stage;
};
