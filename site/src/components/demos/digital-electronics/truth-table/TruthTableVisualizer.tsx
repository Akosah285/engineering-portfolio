import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  AND,
  NAND,
  NOR,
  NOT,
  OR,
  XNOR,
  XOR,
  minterms,
  rowKey,
  truthTable,
} from "./algorithm";
import {
  DEFAULT_STATE,
  GATE_TYPES,
  type GateType,
  PRESETS,
  clampNInputs,
} from "./presets";
import "./TruthTableVisualizer.css";

/**
 * <TruthTableVisualizer> — combinational logic truth-table demo (#115).
 *
 * Renders a classic ANSI gate symbol on a canvas alongside an HTML
 * truth-table for the selected gate / arity. Powered entirely by the
 * pure {@link truthTable} algorithm and the gate primitives exposed
 * from `./algorithm.ts`.
 */

const STATE_SCHEMA = {
  gate: { type: "enum", default: DEFAULT_STATE.gate, values: GATE_TYPES },
  nInputs: { type: "number", default: DEFAULT_STATE.nInputs },
} as const satisfies Schema;

function inputNames(n: number): string[] {
  // A, B, C, D — n is bounded to ≤ 4 by clampNInputs.
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
}

function evaluateGate(gate: GateType, values: boolean[]): boolean {
  switch (gate) {
    case "AND":
      if (values.length === 0) return true;
      return values.reduce((acc, v, i) => (i === 0 ? v : AND(acc, v)), false);
    case "OR":
      if (values.length === 0) return false;
      return values.reduce((acc, v, i) => (i === 0 ? v : OR(acc, v)), false);
    case "NAND":
      return !values.every((v) => v);
    case "NOR":
      return !values.some((v) => v);
    case "XOR":
      // odd parity
      return values.reduce((acc, v) => (v ? !acc : acc), false);
    case "XNOR":
      // even parity (including zero true)
      return !values.reduce((acc, v) => (v ? !acc : acc), false);
    case "NOT":
      return NOT(values[0] ?? false);
    default: {
      // Exhaustiveness — should never hit.
      const _exhaustive: never = gate;
      return _exhaustive;
    }
  }
}

// Use binary primitives so the typed exports aren't reported as unused.
const _binaryGates = { AND, OR, NAND, NOR, XOR, XNOR };
void _binaryGates;

// ----- Canvas drawing --------------------------------------------------------

function drawGateSymbol(
  ctx: CanvasRenderingContext2D,
  gate: GateType,
  nInputs: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#222";
  ctx.fillStyle = "#222";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.font = "14px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Bounding box for the gate body.
  const bodyW = 110;
  const bodyH = 90;
  const cx = width / 2;
  const cy = height / 2;
  const left = cx - bodyW / 2;
  const right = cx + bodyW / 2;
  const top = cy - bodyH / 2;
  const bottom = cy + bodyH / 2;

  const inverted = gate === "NAND" || gate === "NOR" || gate === "XNOR";
  const baseGate: GateType =
    gate === "NAND" ? "AND" : gate === "NOR" ? "OR" : gate === "XNOR" ? "XOR" : gate;

  // Draw body
  ctx.beginPath();
  if (baseGate === "AND") {
    // D-shape: vertical back, semicircle front
    ctx.moveTo(left, top);
    ctx.lineTo(cx, top);
    ctx.arc(cx, cy, bodyH / 2, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(left, bottom);
    ctx.closePath();
  } else if (baseGate === "OR" || baseGate === "XOR") {
    // Shield shape with curved back + pointed front
    ctx.moveTo(left, top);
    ctx.quadraticCurveTo(left + 30, cy, left, bottom);
    ctx.quadraticCurveTo(cx, bottom, right, cy);
    ctx.quadraticCurveTo(cx, top, left, top);
    ctx.closePath();
  } else if (baseGate === "NOT") {
    // Triangle pointing right
    ctx.moveTo(left, top);
    ctx.lineTo(right, cy);
    ctx.lineTo(left, bottom);
    ctx.closePath();
  }
  ctx.stroke();

  // XOR back-curve
  if (baseGate === "XOR") {
    ctx.beginPath();
    ctx.moveTo(left - 8, top);
    ctx.quadraticCurveTo(left + 22, cy, left - 8, bottom);
    ctx.stroke();
  }

  // Inversion bubble for N* gates
  if (inverted) {
    ctx.beginPath();
    ctx.arc(right + 6, cy, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Output line
  const outStart = inverted ? right + 12 : right;
  ctx.beginPath();
  ctx.moveTo(outStart, cy);
  ctx.lineTo(outStart + 50, cy);
  ctx.stroke();
  ctx.fillText("Y", outStart + 50 + 14, cy);

  // Input lines + labels
  const names = inputNames(nInputs);
  const inputLineX = left - 60;
  const inputEntryX =
    baseGate === "OR" || baseGate === "XOR" ? left + 14 : left;
  const spacing = bodyH / (names.length + 1);
  names.forEach((name, i) => {
    const y = top + spacing * (i + 1);
    ctx.beginPath();
    ctx.moveTo(inputLineX, y);
    ctx.lineTo(inputEntryX, y);
    ctx.stroke();
    ctx.fillText(name, inputLineX - 12, y);
  });

  // Gate label
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText(gate, cx, bottom + 18);
}

// ----- Component -------------------------------------------------------------

export function TruthTableVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "truth-table",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const effectiveN = clampNInputs(state.gate, state.nInputs);
  const inputs = useMemo(() => inputNames(effectiveN), [effectiveN]);

  const rows = useMemo(
    () =>
      truthTable({
        inputs,
        evaluate: (assignment) =>
          evaluateGate(
            state.gate,
            inputs.map((name) => assignment[name] ?? false),
          ),
      }),
    [inputs, state.gate],
  );

  const mintermList = useMemo(() => minterms(rows), [rows]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      drawGateSymbol(ctx, state.gate, effectiveN);
    },
    [state.gate, effectiveN],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  // Map gate enum to slider index for the SliderRow control.
  const gateIndex = GATE_TYPES.indexOf(state.gate);

  return (
    <div className="tt-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Truth-table presets"
      />

      <div className="tt-visualizer__stage">
        <div className="tt-visualizer__panel">
          <p className="tt-visualizer__panel-title">Gate symbol</p>
          <DemoCanvas
            width={420}
            height={260}
            ariaLabel={`ANSI ${state.gate} gate with ${effectiveN} input${effectiveN === 1 ? "" : "s"}`}
            draw={draw}
            paused
          />
        </div>

        <div className="tt-visualizer__panel">
          <p className="tt-visualizer__panel-title">Truth table</p>
          <table className="tt-visualizer__table" role="table">
            <thead>
              <tr>
                {inputs.map((name) => (
                  <th key={name} scope="col">
                    {name}
                  </th>
                ))}
                <th scope="col">Y</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const key = rowKey(row, inputs);
                return (
                  <tr
                    key={`${key}-${index}`}
                    className={
                      row.output
                        ? "tt-visualizer__row tt-visualizer__row--true"
                        : "tt-visualizer__row"
                    }
                  >
                    {inputs.map((name) => (
                      <td key={name}>{row.assignment[name] ? "1" : "0"}</td>
                    ))}
                    <td className="tt-visualizer__out">{row.output ? "1" : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tt-visualizer__hud" aria-live="polite">
        <span>
          gate: <strong>{state.gate}</strong>
        </span>
        <span>
          rows: <strong>{rows.length}</strong>
        </span>
        <span>
          minterms: <strong>{mintermList.length}</strong>
        </span>
        <span>
          m = <strong>[{mintermList.join(", ")}]</strong>
        </span>
      </div>

      <div className="tt-visualizer__controls">
        <SliderRow
          label="Gate"
          description="Logic gate operation."
          min={0}
          max={GATE_TYPES.length - 1}
          step={1}
          value={gateIndex < 0 ? 0 : gateIndex}
          onChange={(idx) => {
            const next = GATE_TYPES[Math.round(idx)] ?? "AND";
            setState({ ...state, gate: next });
          }}
          hideTicks
          format={{ precision: 0 }}
        />
        <SliderRow
          label="nInputs"
          description="Number of inputs (clamped to 1 for NOT)."
          min={1}
          max={4}
          step={1}
          value={effectiveN}
          onChange={(n) => setState({ ...state, nInputs: clampNInputs(state.gate, n) })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="tt-visualizer__actions">
        <button type="button" className="tt-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="tt-visualizer__counter" aria-live="off">
          rows {rows.length} · minterms {mintermList.length}
        </span>
      </div>
    </div>
  );
}

export default TruthTableVisualizer;
