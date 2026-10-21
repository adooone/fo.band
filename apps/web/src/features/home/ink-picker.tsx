import { INK } from './forest-renderer';

const STORAGE_KEY = 'fo.ink';

/** The ink picked last time in this browser, or the default. */
export const loadInk = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && /^#[0-9a-f]{6}$/i.test(saved) ? saved : INK;
  } catch {
    return INK;
  }
};

const saveInk = (ink: string) => {
  try {
    if (ink === INK) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, ink);
  } catch {}
};

/** Whether the picker is wanted: in dev, or with `?tune` in the URL. */
export const inkPickerWanted = (): boolean =>
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && window.location.search.includes('tune'));

type InkPickerProps = {
  value: string;
  onChange: (ink: string) => void;
};

/**
 * A quiet swatch for picking the ink by hand, in paper on the ink ground of
 * the home page, centred between the horizon and Puget Sound: a round
 * colour well and its hex, either of which opens the picker, and, once
 * changed, a way back to the default. The pick is kept in this browser only; the default is `INK`.
 */
export const InkPicker = ({ value, onChange }: InkPickerProps) => {
  const set = (ink: string) => {
    saveInk(ink);
    onChange(ink);
  };
  return (
    <div
      className="absolute left-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-[0.6em] font-text text-paper sm:flex"
      style={{
        // Halfway between the ground under the mark and the top of Puget
        // Sound (40 + 53 design px off the bottom).
        top: 'calc(87% - 46 * var(--kc))',
        fontSize: 'clamp(12px, calc(15 * var(--kc)), 16px)',
      }}
    >
      <label className="flex cursor-pointer items-center gap-[0.6em]">
        <input
          type="color"
          aria-label="ink"
          value={value}
          onChange={(e) => set(e.target.value)}
          className="h-[1.1em] w-[1.1em] cursor-pointer appearance-none rounded-full border border-paper/60 bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
        />
        <span className="tabular-nums opacity-60 transition-opacity duration-300 hover:opacity-100">
          {value}
        </span>
      </label>
      {value !== INK && (
        <button
          type="button"
          onClick={() => set(INK)}
          aria-label="back to the default ink"
          className="opacity-40 transition-opacity duration-300 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
};
