import { useState } from 'react';
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

const SLIDERS: Slider[] = [
  {
    key: 'logo',
    label: 'логотип, частка висоти',
    min: 0.15,
    max: 0.6,
    step: 0.01,
  },
  { key: 'oLift', label: 'o: вгору', min: -40, max: 200, step: 1 },
  { key: 'oShift', label: 'o: вправо', min: -60, max: 160, step: 1 },
  {
    key: 'horizon',
    label: 'горизонт (частка висоти)',
    min: 0.5,
    max: 0.9,
    step: 0.01,
  },
  { key: 'hill', label: 'пагорб у центрі', min: 0, max: 0.2, step: 0.005 },
  { key: 'waves', label: 'дрібні хвилі', min: 0, max: 0.05, step: 0.001 },
  { key: 'waveCount', label: 'кількість хвиль', min: 0.5, max: 8, step: 0.1 },
  {
    key: 'treeMax',
    label: 'дерева: макс (частка лого)',
    min: 0.1,
    max: 0.8,
    step: 0.01,
  },
  {
    key: 'treeMin',
    label: 'дерева: мін (частка макс)',
    min: 0.1,
    max: 1,
    step: 0.01,
  },
  { key: 'gap', label: 'проміжок між деревами', min: 0, max: 3, step: 0.05 },
  { key: 'clearing', label: 'галявина', min: 0, max: 0.4, step: 0.01 },
  { key: 'spruces', label: 'частка ялин', min: 0, max: 1, step: 0.05 },
  { key: 'bushes', label: 'кущі на дерево', min: 0, max: 2, step: 0.05 },
  { key: 'trunk', label: 'стовбур круглих', min: 0.1, max: 0.6, step: 0.01 },
  { key: 'grassAmp', label: 'трава: амплітуда', min: 0, max: 8, step: 0.1 },
  {
    key: 'grassWavelength',
    label: 'трава: довжина хвилі',
    min: 10,
    max: 200,
    step: 1,
  },
  { key: 'grassSpeed', label: 'трава: швидкість', min: 0, max: 3, step: 0.05 },
  { key: 'wind', label: 'вітер', min: 0, max: 3, step: 0.05 },
  { key: 'gustEvery', label: 'пориви кожні, с', min: 3, max: 40, step: 0.5 },
  { key: 'gustSeconds', label: 'порив триває, с', min: 1, max: 12, step: 0.1 },
  { key: 'breathSeconds', label: 'дихання, с', min: 2, max: 20, step: 0.5 },
  { key: 'wobble', label: 'дрож лінії', min: 0, max: 4, step: 0.1 },
  { key: 'morphSeconds', label: 'морф, с', min: 0.3, max: 6, step: 0.1 },
  {
    key: 'morphStagger',
    label: 'морф: затримка до країв, с',
    min: 0,
    max: 4,
    step: 0.1,
  },
  { key: 'seed', label: 'seed', min: 1, max: 50, step: 1 },
];

const STORAGE_KEY = 'fo.tuning';

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

type TunerProps = {
  value: Tuning;
  onChange: (next: Tuning) => void;
};

/** Sliders for every knob of the forest and the mark, along the bottom. */
export const Tuner = ({ value, onChange }: TunerProps) => {
  const [open, setOpen] = useState(false);
  const set = (key: keyof Tuning, v: number) => {
    const next = { ...value, [key]: v };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    onChange(next);
  };
  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    onChange(DEFAULT_TUNING);
  };
  const changed = Object.fromEntries(
    (Object.keys(value) as (keyof Tuning)[])
      .filter((k) => value[k] !== DEFAULT_TUNING[k])
      .map((k) => [k, value[k]]),
  );
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 font-sans text-[12px] text-paper">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="absolute bottom-full left-1/2 -translate-x-1/2 rounded-t bg-ink/80 px-3 py-1 opacity-60 hover:opacity-100"
      >
        {open ? 'сховати' : 'крутилки'}
      </button>
      {open && (
        <div className="max-h-[45vh] overflow-y-auto bg-ink/90 px-4 py-3 backdrop-blur">
          <div className="grid gap-x-6 gap-y-1 md:grid-cols-2 lg:grid-cols-3">
            {SLIDERS.map((s) => (
              <label key={s.key} className="flex items-center gap-2">
                <span className="w-44 shrink-0 opacity-80">{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={value[s.key]}
                  onChange={(e) => set(s.key, Number(e.target.value))}
                  className="flex-1 accent-paper"
                />
                <span className="w-12 text-right tabular-nums">
                  {value[s.key]}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-start gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded border border-paper/40 px-2 py-0.5 hover:bg-paper/10"
            >
              скинути
            </button>
            <code className="flex-1 select-all break-all opacity-70">
              {JSON.stringify(changed)}
            </code>
          </div>
        </div>
      )}
    </div>
  );
};
