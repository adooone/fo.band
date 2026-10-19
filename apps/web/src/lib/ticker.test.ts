import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClock, MAX_STEP_SECONDS } from './ticker';

/** Drives performance.now() by hand, in milliseconds. */
const fakeTime = () => {
  let ms = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => ms);
  return {
    advance(by: number) {
      ms += by;
    },
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createClock', () => {
  it('advances by real elapsed time between frames', () => {
    const time = fakeTime();
    const clock = createClock();
    clock.tick(0);
    time.advance(16);
    clock.tick(16);
    time.advance(16);
    expect(clock.tick(32)).toBeCloseTo(0.032, 6);
  });

  it('ignores frame timestamps: a burst of catch-up frames barely moves it', () => {
    const time = fakeTime();
    const clock = createClock();
    clock.tick(0);
    // Sixty frames whose stamps claim a second passed, delivered in 1 ms.
    for (let i = 1; i <= 60; i++) {
      time.advance(1 / 60);
      clock.tick(i * 16.7);
    }
    expect(clock.now()).toBeLessThan(0.002);
  });

  it('clamps a long gap to one small step', () => {
    const time = fakeTime();
    const clock = createClock();
    clock.tick(0);
    time.advance(10 * 60 * 1000);
    expect(clock.tick(0)).toBe(MAX_STEP_SECONDS);
  });

  it('skips the step after the page is hidden or shown', () => {
    const time = fakeTime();
    const clock = createClock();
    clock.tick(0);
    time.advance(16);
    clock.tick(0);
    document.dispatchEvent(new Event('visibilitychange'));
    time.advance(40);
    expect(clock.tick(0)).toBeCloseTo(0.016, 6);
    time.advance(16);
    expect(clock.tick(0)).toBeCloseTo(0.032, 6);
  });

  it('stays still when frozen', () => {
    const time = fakeTime();
    const clock = createClock(true);
    clock.tick(0);
    time.advance(500);
    expect(clock.tick(0)).toBe(0);
  });
});
