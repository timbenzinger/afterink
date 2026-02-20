"use client";

import type { DisplacementConfig } from "@/types/config";

interface ControlsPanelProps {
  config: DisplacementConfig;
  onChange: (partial: Partial<DisplacementConfig>) => void;
}

interface SliderDef {
  key: keyof DisplacementConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

const DISPLACEMENT_SLIDERS: SliderDef[] = [
  { key: "amountPx", label: "Amount (px)", min: 0, max: 12, step: 0.1 },
  { key: "size", label: "Size", min: 2, max: 80, step: 1 },
  { key: "octaves", label: "Complexity", min: 1, max: 6, step: 1 },
  { key: "speed", label: "Speed", min: 0, max: 3, step: 0.05 },
  { key: "seed", label: "Seed", min: 0, max: 100, step: 1 },
  {
    key: "edgeStrength",
    label: "Edge Strength",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "edgeThreshold",
    label: "Edge Threshold",
    min: 0,
    max: 1,
    step: 0.01,
  },
];

export default function ControlsPanel({
  config,
  onChange,
}: ControlsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Turbulent displacement controls */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
          Displacement
        </h3>
        {DISPLACEMENT_SLIDERS.map((s) => (
          <Slider
            key={s.key}
            label={s.label}
            value={config[s.key] as number}
            min={s.min}
            max={s.max}
            step={s.step}
            onChange={(v) => onChange({ [s.key]: v })}
          />
        ))}
      </div>

      {/* Loop controls */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
          Loop
        </h3>
        <Slider
          label="Duration (s)"
          value={config.loopDuration}
          min={2}
          max={6}
          step={0.5}
          onChange={(v) => onChange({ loopDuration: v })}
        />
        <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-zinc-500">
          <label htmlFor="fps-select">Export FPS:</label>
          <select
            id="fps-select"
            value={config.fps}
            onChange={(e) => onChange({ fps: Number(e.target.value) })}
            className="rounded bg-stone-200 px-2 py-1 text-stone-800 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <option value={4}>4</option>
            <option value={6}>6</option>
            <option value={8}>8</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={30}>30</option>
          </select>
        </div>

        {/* Posterize time — equivalent to posterizeTime(N) in After Effects */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-700 dark:text-zinc-300">Posterize</span>
            <span className="tabular-nums text-stone-400 dark:text-zinc-500">
              {config.posterize === 0 ? "off" : `${config.posterize} fps`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={config.posterize}
            onChange={(e) => onChange({ posterize: Number(e.target.value) })}
            className="slider w-full"
          />
          <p className="text-[10px] leading-tight text-stone-400 dark:text-zinc-600">
            0 = smooth · 4–8 = sketch jitter · holds then snaps between frames
          </p>
        </div>
      </div>

      {/* Background controls */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
          Background
        </h3>
        <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={config.bgTransparent}
            onChange={(e) => onChange({ bgTransparent: e.target.checked })}
            className="rounded"
          />
          Transparent
        </label>
        {!config.bgTransparent && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-400 dark:text-zinc-500">Color:</label>
            <input
              type="color"
              value={config.bgColor}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              className="h-7 w-10 cursor-pointer rounded border border-stone-300 bg-transparent dark:border-zinc-600"
            />
            <span className="text-xs text-stone-400 dark:text-zinc-500">{config.bgColor}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-700 dark:text-zinc-300">{label}</span>
        <span className="tabular-nums text-stone-400 dark:text-zinc-500">
          {step < 1 ? value.toFixed(2) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider w-full"
      />
    </div>
  );
}
