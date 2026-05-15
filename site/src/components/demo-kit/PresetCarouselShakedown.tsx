import { useState } from "react";
import { PresetCarousel } from "./PresetCarousel";

interface SamplePresetState {
  rate: number;
  label: string;
}

const SAMPLE_PRESETS = [
  { name: "Slow", state: { rate: 0.1, label: "Slow" } satisfies SamplePresetState },
  { name: "Medium", state: { rate: 1.0, label: "Medium" } satisfies SamplePresetState },
  { name: "Fast", state: { rate: 10.0, label: "Fast" } satisfies SamplePresetState },
];

const FIRST_PRESET: SamplePresetState = SAMPLE_PRESETS[0]?.state ?? {
  rate: 0,
  label: "",
};

/**
 * Shakedown consumer for <PresetCarousel> — used on /dev/demo-kit/ to verify
 * the React island hydrates and click handlers fire end-to-end.
 */
export function PresetCarouselShakedown() {
  const [selected, setSelected] = useState<SamplePresetState>(FIRST_PRESET);

  return (
    <div>
      <PresetCarousel presets={SAMPLE_PRESETS} onSelect={(state) => setSelected(state)} />
      <p
        style={{
          marginTop: "0.75rem",
          fontFamily: "JetBrains Mono Variable, monospace",
          fontSize: "0.8125rem",
          color: "var(--color-text-muted)",
        }}
      >
        current: {selected.label} (rate = {selected.rate})
      </p>
    </div>
  );
}
