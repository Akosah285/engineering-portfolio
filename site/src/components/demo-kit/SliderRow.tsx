import { useId } from "react";
import { formatSliderValue, type FormatOptions } from "./sliderFormat";
import "./SliderRow.css";

/**
 * <SliderRow> — labeled native <input type="range"> (plan §3.1, #15).
 *
 * Pure-controlled component: parent owns the value, SliderRow renders
 * the input + label + value display + min/max ticks. Native range gives
 * us touch + keyboard + screen-reader support for free.
 *
 * @example
 *   const [eta, setEta] = useState(0.05);
 *   <SliderRow
 *     label="Learning rate"
 *     min={0.001}
 *     max={0.5}
 *     step={0.001}
 *     value={eta}
 *     onChange={setEta}
 *     format={{ precision: 3 }}
 *   />
 */

export interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;
  /** Optional secondary description; rendered as <span> below the label. */
  description?: string;
  /** Override or extend the auto-format. */
  format?: FormatOptions;
  /** Disable the input. */
  disabled?: boolean;
  /** Hide the min/max tick marks (default: show). */
  hideTicks?: boolean;
  /** Optional unique id; auto-generated otherwise. */
  id?: string;
}

export function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  description,
  format,
  disabled = false,
  hideTicks = false,
  id,
}: SliderRowProps) {
  const reactId = useId();
  const inputId = id ?? `slider-${reactId}`;
  const descId = description ? `${inputId}-desc` : undefined;
  const display = formatSliderValue(value, format);
  const minDisplay = formatSliderValue(min, format);
  const maxDisplay = formatSliderValue(max, format);

  return (
    <div className="slider-row">
      <div className="slider-row__head">
        <label className="slider-row__label" htmlFor={inputId}>
          {label}
        </label>
        <output className="slider-row__value" htmlFor={inputId}>
          {display}
        </output>
      </div>
      {description ? (
        <p className="slider-row__description" id={descId}>
          {description}
        </p>
      ) : null}
      <input
        id={inputId}
        type="range"
        className="slider-row__input"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-describedby={descId}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
      {hideTicks ? null : (
        <div className="slider-row__ticks" aria-hidden="true">
          <span className="slider-row__tick">{minDisplay}</span>
          <span className="slider-row__tick">{maxDisplay}</span>
        </div>
      )}
    </div>
  );
}
