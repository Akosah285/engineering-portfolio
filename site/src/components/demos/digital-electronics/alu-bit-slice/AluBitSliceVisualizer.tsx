import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type AluOp, alu, fromSigned4, toBinary4 } from "./algorithm";
import { DEFAULT_STATE, PRESETS } from "./presets";
import "./AluBitSliceVisualizer.css";

const OPS: readonly AluOp[] = [
  "ADD",
  "SUB",
  "AND",
  "OR",
  "XOR",
  "NOT",
  "SHL",
  "SHR",
] as const;

const STATE_SCHEMA = {
  op: { type: "enum", default: DEFAULT_STATE.op, values: OPS },
  a: { type: "number", default: DEFAULT_STATE.a },
  b: { type: "number", default: DEFAULT_STATE.b },
} as const satisfies Schema;

function BitRow({
  label,
  value,
  dim = false,
}: {
  label: string;
  value: number;
  dim?: boolean;
}) {
  const bits = toBinary4(value).split("");
  return (
    <div
      className={
        dim ? "alu-visualizer__row alu-visualizer__row--dim" : "alu-visualizer__row"
      }
    >
      <span className="alu-visualizer__row-label">{label}</span>
      <div className="alu-visualizer__cells">
        {bits.map((bit, i) => (
          <div
            key={i}
            className={
              bit === "1"
                ? "alu-visualizer__cell alu-visualizer__cell--on"
                : "alu-visualizer__cell"
            }
          >
            {bit}
          </div>
        ))}
      </div>
    </div>
  );
}

function Flag({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={
        on ? "alu-visualizer__flag alu-visualizer__flag--on" : "alu-visualizer__flag"
      }
    >
      {label}
    </span>
  );
}

export default function AluBitSliceVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "alu-bit-slice",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const result = alu(state.op, state.a, state.b);
  const opIndex = OPS.indexOf(state.op);
  const isNot = state.op === "NOT";

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="alu-visualizer">
      <PresetCarousel
        presets={PRESETS as unknown as { name: string; state: typeof state }[]}
        onSelect={handlePresetSelect as (next: typeof state) => void}
        ariaLabel="ALU presets"
      />

      <div className="alu-visualizer__hud">
        {state.op} · A={state.a} · B={state.b}
      </div>

      <div className="alu-visualizer__grid">
        <BitRow label="A" value={state.a} />
        <BitRow label="B" value={state.b} dim={isNot} />
        <BitRow label="Result" value={result.result} />
      </div>

      <div className="alu-visualizer__flags">
        <Flag label="Z" on={result.zero} />
        <Flag label="N" on={result.negative} />
        <Flag label="C" on={result.carry} />
        <Flag label="V" on={result.overflow} />
        <Flag label="Borrow" on={result.borrow} />
      </div>

      <div className="alu-visualizer__counter" aria-live="off">
        r={result.result} (0b{toBinary4(result.result)})
      </div>

      <div className="alu-visualizer__readout">
        <span>
          unsigned: {state.a}, {state.b} → {result.result}
        </span>
        <span>
          signed: {fromSigned4(state.a)}, {fromSigned4(state.b)} →{" "}
          {fromSigned4(result.result)}
        </span>
      </div>

      <div className="alu-visualizer__controls">
        <SliderRow
          label="Operation"
          min={0}
          max={OPS.length - 1}
          step={1}
          value={opIndex}
          onChange={(i) => {
            const next = OPS[Math.round(i)]!;
            setState({ ...state, op: next });
          }}
          format={{ precision: 0, unit: state.op }}
          hideTicks
        />
        <SliderRow
          label="A (0..15)"
          min={0}
          max={15}
          step={1}
          value={state.a}
          onChange={(a) => setState({ ...state, a })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="B (0..15)"
          min={0}
          max={15}
          step={1}
          value={state.b}
          onChange={(b) => setState({ ...state, b })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="alu-visualizer__actions">
        <button
          type="button"
          className="alu-visualizer__btn"
          onClick={reset}
          aria-label="Reset alu state"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
