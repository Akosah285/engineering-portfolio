import { useMemo, useState } from "react";
import { cyclePresetIndex } from "./presetCycle";
import "./PresetCarousel.css";

/**
 * <PresetCarousel> — chip-based preset selector (plan §6.2, #16).
 *
 * Renders a horizontal row of preset chips with ◀ Prev / Next ▶ controls.
 * Used as the desktop preset selector AND as the touch-device fallback
 * for canvas-drag demos where pixel-precise dragging is awkward.
 *
 * All tap targets are ≥ 44×44 px so they're comfortable on touch.
 *
 * The component is "uncontrolled" — it owns the currently-selected
 * index, fires `onSelect(state)` on every change. Pass a known
 * `initialIndex` to seed; the parent doesn't need to track the index.
 *
 * @example
 *   const presets = [
 *     { name: "Slow", state: { rate: 0.1 } },
 *     { name: "Medium", state: { rate: 1.0 } },
 *     { name: "Fast", state: { rate: 10.0 } },
 *   ];
 *   <PresetCarousel presets={presets} onSelect={setState} />
 */

export interface Preset<T> {
  name: string;
  state: T;
}

export interface PresetCarouselProps<T> {
  presets: Preset<T>[];
  onSelect: (state: T, preset: Preset<T>) => void;
  initialIndex?: number;
  /** Optional aria-label for the carousel region. */
  ariaLabel?: string;
}

export function PresetCarousel<T>({
  presets,
  onSelect,
  initialIndex = 0,
  ariaLabel = "Demo presets",
}: PresetCarouselProps<T>) {
  const [active, setActive] = useState(() => {
    if (initialIndex < 0 || initialIndex >= presets.length) return 0;
    return initialIndex;
  });

  const hasPresets = presets.length > 0;

  const select = (next: number): void => {
    setActive(next);
    const preset = presets[next];
    if (preset) onSelect(preset.state, preset);
  };

  const onPrev = (): void => {
    select(cyclePresetIndex(active, presets.length, "prev"));
  };
  const onNext = (): void => {
    select(cyclePresetIndex(active, presets.length, "next"));
  };

  const chips = useMemo(
    () =>
      presets.map((preset, index) => ({
        preset,
        index,
        isActive: index === active,
      })),
    [presets, active],
  );

  if (!hasPresets) return null;

  return (
    <div
      className="preset-carousel"
      role="region"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className="preset-carousel__nav"
        onClick={onPrev}
        aria-label="Previous preset"
      >
        <span aria-hidden="true">◀</span>
      </button>

      <ul className="preset-carousel__chips" role="listbox">
        {chips.map(({ preset, index, isActive }) => (
          <li key={`${preset.name}-${index}`}>
            <button
              type="button"
              className={
                isActive
                  ? "preset-carousel__chip preset-carousel__chip--active"
                  : "preset-carousel__chip"
              }
              role="option"
              aria-selected={isActive}
              onClick={() => select(index)}
            >
              {preset.name}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="preset-carousel__nav"
        onClick={onNext}
        aria-label="Next preset"
      >
        <span aria-hidden="true">▶</span>
      </button>
    </div>
  );
}
