/**
 * One requestAnimationFrame loop shared by every animated canvas on the page.
 * It only runs while something is subscribed, so hidden or paused canvases
 * cost nothing and the browser schedules a single callback per frame.
 */

type Tick = (now: number) => void;

const subscribers = new Set<Tick>();
let frame = 0;

// Subscribers get the wall clock, not the frame's timestamp: after a long
// spell in the background a browser may flush a burst of frames whose
// timestamps are spread out as if they had run on time, and a clock fed
// those would fast-forward the animation in an instant.
const loop = () => {
  frame = 0;
  const now = performance.now();
  for (const tick of subscribers) tick(now);
  if (subscribers.size > 0) frame = requestAnimationFrame(loop);
};

export const subscribeTick = (tick: Tick): (() => void) => {
  subscribers.add(tick);
  if (!frame) frame = requestAnimationFrame(loop);
  return () => {
    subscribers.delete(tick);
    if (subscribers.size === 0 && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
};

/** Device pixel ratio capped so 3× phones don't pay for pixels nobody sees. */
export const cappedDpr = (max = 2): number =>
  Math.min(max, window.devicePixelRatio || 1);

/**
 * An animation clock driven by real elapsed time between ticks, each step
 * clamped to MAX_STEP. A throttled background tab (one frame a second), a
 * long sleep or a burst of catch-up frames then pauses the animation instead
 * of fast-forwarding it, so the waves never race. The frame timestamp passed
 * in is ignored in favour of the wall clock (see `loop`), and the step after
 * the page comes back from hiding is dropped altogether.
 */
export const MAX_STEP_SECONDS = 0.05;

// Bumped whenever the page is hidden or shown, so every clock skips the
// first step after that (one shared listener, nothing to clean up per clock).
let visibilityEpoch = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    visibilityEpoch++;
  });
}

export const createClock = (frozen = false) => {
  let seconds = 0;
  let last = Number.NaN;
  let epoch = visibilityEpoch;
  return {
    /** Advances by the real time since the last tick (clamped), in seconds. */
    tick(_now: number): number {
      const now = performance.now();
      if (epoch !== visibilityEpoch) {
        epoch = visibilityEpoch;
        last = Number.NaN;
      }
      if (!frozen) {
        const delta = Number.isNaN(last) ? 0 : (now - last) / 1000;
        seconds += Math.min(MAX_STEP_SECONDS, Math.max(0, delta));
      }
      last = now;
      return seconds;
    },
    /** The current time without advancing it. */
    now(): number {
      return seconds;
    },
  };
};

export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Calls `onChange` when the element enters or leaves the viewport (or is
 * display:none). Without IntersectionObserver it reports visible once.
 */
export const observeVisible = (
  element: Element,
  onChange: (visible: boolean) => void,
): (() => void) => {
  if (typeof IntersectionObserver === 'undefined') {
    onChange(true);
    return () => {};
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) onChange(entry.isIntersecting);
  });
  observer.observe(element);
  return () => observer.disconnect();
};
