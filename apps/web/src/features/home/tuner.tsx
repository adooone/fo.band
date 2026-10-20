import {
  DEFAULT_MARK,
  DEFAULT_OPTIONS,
  type ForestOptions,
  type MarkOptions,
} from './forest-renderer';

export type Tuning = ForestOptions & MarkOptions;
export const DEFAULT_TUNING: Tuning = { ...DEFAULT_OPTIONS, ...DEFAULT_MARK };

type Slider = {
  key: keyof Tuning;
  label: string;
  min: number;
  max: number;
  step: number;
};

type Group = { title: string; sliders: Slider[] };

const GROUPS: Group[] = [
  {
    title: 'Логотип',
    sliders: [
      {
        key: 'logo',
        label: 'розмір, частка висоти',
        min: 0.15,
        max: 0.6,
        step: 0.01,
      },
      { key: 'oLift', label: 'o: вгору', min: -40, max: 200, step: 1 },
      { key: 'oShift', label: 'o: вправо', min: -60, max: 160, step: 1 },
      { key: 'oScale', label: 'o: розмір', min: 0.3, max: 1.3, step: 0.01 },
      { key: 'markWobble', label: 'дрож контуру', min: 0, max: 5, step: 0.1 },
      { key: 'markBreath', label: 'дихання, с', min: 2, max: 15, step: 0.5 },
    ],
  },
  {
    title: 'Паросток f',
    sliders: [
      { key: 'sproutSeconds', label: 'ріст, с', min: 1, max: 12, step: 0.1 },
      { key: 'coil', label: 'закрученість', min: 0, max: 5, step: 0.05 },
    ],
  },
  {
    title: 'Горизонт',
    sliders: [
      {
        key: 'horizon',
        label: 'висота, частка екрана',
        min: 0.5,
        max: 0.9,
        step: 0.01,
      },
      { key: 'hill', label: 'пагорб у центрі', min: 0, max: 0.2, step: 0.005 },
      { key: 'waves', label: 'дрібні хвилі', min: 0, max: 0.05, step: 0.001 },
      {
        key: 'waveCount',
        label: 'кількість хвиль',
        min: 0.5,
        max: 8,
        step: 0.1,
      },
      { key: 'wobble', label: 'дрож лінії', min: 0, max: 4, step: 0.1 },
      { key: 'breathSeconds', label: 'дихання, с', min: 2, max: 20, step: 0.5 },
    ],
  },
  {
    title: 'Дерева',
    sliders: [
      {
        key: 'treeMax',
        label: 'макс, частка лого',
        min: 0.1,
        max: 0.8,
        step: 0.01,
      },
      {
        key: 'treeMin',
        label: 'мін, частка макс',
        min: 0.1,
        max: 1,
        step: 0.01,
      },
      { key: 'gap', label: 'проміжок', min: 0, max: 3, step: 0.05 },
      { key: 'clearing', label: 'галявина', min: 0, max: 0.4, step: 0.01 },
      { key: 'spruces', label: 'частка ялин', min: 0, max: 1, step: 0.05 },
      { key: 'bushes', label: 'кущі на дерево', min: 0, max: 2, step: 0.05 },
      {
        key: 'trunk',
        label: 'стовбур круглих',
        min: 0.04,
        max: 0.4,
        step: 0.01,
      },
      { key: 'seed', label: 'seed', min: 1, max: 50, step: 1 },
    ],
  },
  {
    title: 'Трава',
    sliders: [
      { key: 'grassAmp', label: 'амплітуда', min: 0, max: 8, step: 0.1 },
      {
        key: 'grassWavelength',
        label: 'довжина хвилі',
        min: 6,
        max: 200,
        step: 1,
      },
      { key: 'grassSpeed', label: 'швидкість', min: 0, max: 3, step: 0.05 },
    ],
  },
  {
    title: 'Вітер',
    sliders: [
      { key: 'wind', label: 'сила', min: 0, max: 3, step: 0.05 },
      {
        key: 'gustEvery',
        label: 'пориви кожні, с',
        min: 3,
        max: 40,
        step: 0.5,
      },
      {
        key: 'gustSeconds',
        label: 'порив триває, с',
        min: 1,
        max: 12,
        step: 0.1,
      },
    ],
  },
  {
    title: 'Поява',
    sliders: [
      { key: 'morphSeconds', label: 'морф, с', min: 0.3, max: 6, step: 0.1 },
      {
        key: 'morphStagger',
        label: 'затримка до країв, с',
        min: 0,
        max: 4,
        step: 0.1,
      },
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
  const set = (key: keyof Tuning, v: number) => {
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
      aria-label="Крутилки"
    >
      <button
        type="button"
        onClick={onToggle}
        className="absolute top-1/2 right-full -translate-y-1/2 rounded-l bg-black px-1.5 py-3 opacity-60 [writing-mode:vertical-rl] hover:opacity-100"
      >
        {open ? 'сховати' : 'крутилки'}
      </button>
      <div className="flex w-full flex-col bg-black">
        <div className="flex-1 overflow-y-auto px-3 py-3">
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
              повторити появу
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded border border-white/40 px-2 py-1 hover:bg-white/10"
            >
              скинути
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
