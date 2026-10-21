import { DEFAULT_FONTS, FONTS, type FontChoice } from './fonts';
import {
  DEFAULT_MARK,
  DEFAULT_OPTIONS,
  type ForestOptions,
  type MarkOptions,
} from './forest-renderer';

export type Tuning = ForestOptions & MarkOptions & FontChoice;
export const DEFAULT_TUNING: Tuning = {
  ...DEFAULT_OPTIONS,
  ...DEFAULT_MARK,
  ...DEFAULT_FONTS,
};

type Slider = {
  key: keyof (ForestOptions & MarkOptions);
  label: string;
  min: number;
  max: number;
  step: number;
};

type Group = { title: string; sliders: Slider[] };

const GROUPS: Group[] = [
  {
    title: 'Trees',
    sliders: [
      {
        key: 'treeMax',
        label: 'max, share of mark',
        min: 0.1,
        max: 0.8,
        step: 0.01,
      },
      {
        key: 'treeMin',
        label: 'min, share of max',
        min: 0.1,
        max: 1,
        step: 0.01,
      },
      { key: 'gap', label: 'gap', min: 0, max: 3, step: 0.05 },
      { key: 'clearing', label: 'clearing', min: 0, max: 0.4, step: 0.01 },
      { key: 'spruces', label: 'spruce share', min: 0, max: 1, step: 0.05 },
      { key: 'oaks', label: 'oak share', min: 0, max: 1, step: 0.05 },
      { key: 'bushes', label: 'bushes per tree', min: 0, max: 2, step: 0.05 },
      {
        key: 'trunk',
        label: 'round trunk',
        min: 0.04,
        max: 0.4,
        step: 0.01,
      },
      { key: 'seed', label: 'seed', min: 1, max: 50, step: 1 },
    ],
  },
  {
    title: 'Far hills',
    sliders: [
      {
        key: 'farTint',
        label: 'ink in the tint',
        min: 0,
        max: 0.4,
        step: 0.01,
      },
      {
        key: 'farHeight',
        label: 'height in the middle',
        min: 0.03,
        max: 0.2,
        step: 0.005,
      },
      {
        key: 'farDip',
        label: 'higher at the edges',
        min: 0,
        max: 0.2,
        step: 0.005,
      },
      { key: 'farTrees', label: 'tree size', min: 0, max: 2.5, step: 0.05 },
    ],
  },
  {
    title: 'Sky',
    sliders: [
      { key: 'clouds', label: 'clouds', min: 0, max: 10, step: 1 },
      { key: 'farClouds', label: 'far clouds', min: 0, max: 12, step: 1 },
      {
        key: 'cloudTop',
        label: 'clouds from, share of height',
        min: 0,
        max: 0.6,
        step: 0.01,
      },
      {
        key: 'cloudSize',
        label: 'cloud size, share of width',
        min: 0.02,
        max: 0.2,
        step: 0.005,
      },
      { key: 'cloudSpeed', label: 'cloud drift', min: 0, max: 40, step: 0.5 },
      {
        key: 'cloudTint',
        label: 'ink in the clouds',
        min: 0,
        max: 0.4,
        step: 0.01,
      },
      {
        key: 'birdsEvery',
        label: 'birds every, s',
        min: 0,
        max: 60,
        step: 1,
      },
      { key: 'birdsCount', label: 'birds at most', min: 0, max: 7, step: 1 },
      {
        key: 'birdsAbove',
        label: 'birds over the horizon',
        min: 0.02,
        max: 0.6,
        step: 0.01,
      },
      { key: 'birdSize', label: 'bird size', min: 2, max: 16, step: 0.5 },
      {
        key: 'birdSpeed',
        label: 'bird speed, widths per s',
        min: 0.03,
        max: 0.5,
        step: 0.01,
      },
    ],
  },
  {
    title: 'Pencil',
    sliders: [
      { key: 'pencilSeconds', label: 'run, s', min: 0.5, max: 10, step: 0.1 },
      {
        key: 'pencilTrail',
        label: 'tail, share of line',
        min: 0.01,
        max: 0.6,
        step: 0.01,
      },
      { key: 'pencilWander', label: 'wander', min: 0, max: 25, step: 0.5 },
      { key: 'pencilWave', label: 'wander wave', min: 40, max: 600, step: 10 },
      { key: 'pencilWidth', label: 'width', min: 0.5, max: 6, step: 0.1 },
    ],
  },
];

// Only the values that differ from the defaults are saved, so a new default
// is never shadowed by an old one. Bumped to drop tuning saved whole.
const STORAGE_KEY = 'fo.tuning.v3';

export const loadTuning = (): Tuning => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TUNING;
    return { ...DEFAULT_TUNING, ...(JSON.parse(raw) as Partial<Tuning>) };
  } catch {
    return DEFAULT_TUNING;
  }
};

/** Whether the tuning panel is wanted: in dev, or with `?tune` in the URL. */
export const tuningWanted = (): boolean =>
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && window.location.search.includes('tune'));

/** The values that differ from the defaults. */
const diff = (value: Tuning): Partial<Tuning> =>
  Object.fromEntries(
    (Object.keys(value) as (keyof Tuning)[])
      .filter((k) => value[k] !== DEFAULT_TUNING[k])
      .map((k) => [k, value[k]]),
  );

type TunerProps = {
  value: Tuning;
  onChange: (next: Tuning) => void;
  /** Plays the intro again. */
  onReplay: () => void;
  open: boolean;
  onToggle: () => void;
};

const OPEN_KEY = 'fo.tuner.open';

/** Whether the sidebar was left open last time. */
export const loadTunerOpen = (): boolean => {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
};
export const saveTunerOpen = (open: boolean) => {
  try {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {}
};

/** The sidebar's width; the page makes room for it on wider screens. */
export const TUNER_WIDTH = '15rem';

/**
 * Sliders for every knob of the forest and the mark, grouped in a thin
 * scrollable black sidebar on the right.
 */
export const Tuner = ({
  value,
  onChange,
  onReplay,
  open,
  onToggle,
}: TunerProps) => {
  const set = <K extends keyof Tuning>(key: K, v: Tuning[K]) => {
    const next = { ...value, [key]: v };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(diff(next)));
    } catch {}
    onChange(next);
  };
  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    onChange(DEFAULT_TUNING);
  };
  const changed = diff(value);
  return (
    <aside
      className="fixed top-0 right-0 bottom-0 z-20 flex font-sans text-[11px] text-white transition-transform duration-300"
      style={{
        width: `min(${TUNER_WIDTH}, 80vw)`,
        transform: open ? 'none' : 'translateX(100%)',
      }}
      aria-label="Knobs"
    >
      <button
        type="button"
        onClick={onToggle}
        className="absolute top-1/2 right-full -translate-y-1/2 rounded-l bg-black px-1.5 py-3 opacity-60 [writing-mode:vertical-rl] hover:opacity-100"
      >
        {open ? 'hide' : 'knobs'}
      </button>
      <div className="flex w-full flex-col bg-black">
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <section className="mb-4">
            <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.2em] opacity-50">
              Fonts
            </h3>
            {(
              [
                ['fontTitles', 'titles'],
                ['fontText', 'everything else'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="mb-1.5 block">
                <span className="block">{label}</span>
                <select
                  value={value[key]}
                  onChange={(e) =>
                    set(key, e.target.value as Tuning[typeof key])
                  }
                  className="block w-full rounded border border-white/30 bg-black px-1 py-0.5 text-white"
                >
                  {FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </section>
          {GROUPS.map((group) => (
            <section key={group.title} className="mb-4">
              <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.2em] opacity-50">
                {group.title}
              </h3>
              {group.sliders.map((sl) => (
                <label key={sl.key} className="mb-1.5 block">
                  <span className="flex justify-between gap-2">
                    <span
                      className={
                        value[sl.key] === DEFAULT_TUNING[sl.key]
                          ? 'opacity-70'
                          : ''
                      }
                    >
                      {sl.label}
                    </span>
                    <span className="tabular-nums opacity-90">
                      {value[sl.key]}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={sl.min}
                    max={sl.max}
                    step={sl.step}
                    value={value[sl.key]}
                    onChange={(e) => set(sl.key, Number(e.target.value))}
                    className="block h-4 w-full accent-white"
                  />
                </label>
              ))}
            </section>
          ))}
        </div>
        <div className="border-white/15 border-t px-3 py-2">
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={onReplay}
              className="flex-1 rounded border border-white/40 px-2 py-1 hover:bg-white/10"
            >
              replay intro
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded border border-white/40 px-2 py-1 hover:bg-white/10"
            >
              reset
            </button>
          </div>
          <code className="block max-h-20 select-all overflow-y-auto break-all opacity-70">
            {JSON.stringify(changed)}
          </code>
        </div>
      </div>
    </aside>
  );
};
