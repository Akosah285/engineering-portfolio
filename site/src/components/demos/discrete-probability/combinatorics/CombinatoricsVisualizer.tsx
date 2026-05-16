import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { combinations, permutations } from "./algorithm";
import {
  type CombinatoricsDemoState,
  DEFAULT_STATE,
  PRESETS,
  SCENARIO_SLUGS,
  getPresetLabel,
} from "./presets";
import "./CombinatoricsVisualizer.css";

const STATE_SCHEMA = {
  scenarioSlug: {
    type: "enum",
    default: DEFAULT_STATE.scenarioSlug,
    values: SCENARIO_SLUGS,
  },
  n: { type: "number", default: DEFAULT_STATE.n },
  k: { type: "number", default: DEFAULT_STATE.k },
} as const satisfies Schema;

const narrationTemplate = (state: CombinatoricsDemoState): string => {
  const label = getPresetLabel(state.scenarioSlug);
  const kClamped = Math.min(Math.max(state.k, 0), state.n);
  const cVal = combinations(state.n, kClamped);
  const pVal = permutations(state.n, kClamped);
  return `Scenario "${label}". There are ${cVal.toString()} ways to choose ${kClamped} items from ${state.n} (unordered), or ${pVal.toString()} ways if order matters.`;
};

function heatColor(t: number): string {
  // t in [0, 1]: light blue -> dark blue -> crimson
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.5) {
    const u = clamped / 0.5;
    const r = Math.round(220 - u * 180);
    const g = Math.round(235 - u * 175);
    const b = Math.round(250 - u * 90);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const u = (clamped - 0.5) / 0.5;
  const r = Math.round(40 + u * 180);
  const g = Math.round(60 - u * 40);
  const b = Math.round(160 - u * 130);
  return `rgb(${r}, ${g}, ${b})`;
}

export function CombinatoricsVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "combinatorics",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const { n, k } = state;
  const kClamped = Math.min(Math.max(k, 0), n);

  const rows = useMemo<bigint[][]>(() => {
    const out: bigint[][] = [];
    for (let i = 0; i <= n; i += 1) {
      const row: bigint[] = [];
      for (let j = 0; j <= i; j += 1) row.push(combinations(i, j));
      out.push(row);
    }
    return out;
  }, [n]);

  const cVal = useMemo(() => combinations(n, kClamped), [n, kClamped]);
  const pVal = useMemo(() => permutations(n, kClamped), [n, kClamped]);
  const cDisplay = cVal.toString();
  const pDisplay = pVal.toString();

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);

      const denom = n + 2;
      const cellW = width / denom;
      const cellH = height / denom;
      const centerX = width / 2;

      // Determine max value for color scaling (log-scale).
      let maxLog = 0;
      for (let i = 0; i <= n; i += 1) {
        const row = rows[i]!;
        for (let j = 0; j <= i; j += 1) {
          const v = row[j]!;
          if (v > 0n) {
            const l = Math.log(Number(v) + 1);
            if (l > maxLog) maxLog = l;
          }
        }
      }
      if (maxLog === 0) maxLog = 1;

      for (let i = 0; i <= n; i += 1) {
        const row = rows[i]!;
        const y = (i + 0.5) * cellH;
        for (let j = 0; j <= i; j += 1) {
          const v = row[j]!;
          const offset = (j - i / 2) * cellW;
          const cx = centerX + offset;

          const t = Math.log(Number(v) + 1) / maxLog;
          const isEdge = j === 0 || j === i;
          ctx.fillStyle = isEdge ? "rgb(230, 230, 230)" : heatColor(t);
          ctx.fillRect(cx - cellW / 2 + 1, y - cellH / 2 + 1, cellW - 2, cellH - 2);

          const isSelected = i === n && j === kClamped;
          if (isSelected) {
            ctx.strokeStyle = "crimson";
            ctx.lineWidth = 3;
            ctx.strokeRect(
              cx - cellW / 2 + 1,
              y - cellH / 2 + 1,
              cellW - 2,
              cellH - 2,
            );
          }

          // Draw value text if it fits.
          const text = v.toString();
          const fontSize = Math.min(cellH * 0.4, 14);
          ctx.font = `${fontSize}px sans-serif`;
          const textWidth = ctx.measureText(text).width;
          if (textWidth <= cellW - 4 && fontSize >= 7) {
            ctx.fillStyle = isSelected
              ? "#ffffff"
              : t > 0.6
                ? "#ffffff"
                : "#222222";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, cx, y);
          } else if (cellW > 4) {
            ctx.fillStyle = isSelected ? "#ffffff" : "#444444";
            ctx.beginPath();
            ctx.arc(cx, y, Math.min(cellW, cellH) * 0.08, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
    [n, kClamped, rows],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="cb-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Combinatorics presets"
      />

      <div className="cb-visualizer__presets" role="group" aria-label="Scenario quick select">
        {PRESETS.map((preset) => (
          <button
            key={preset.state.scenarioSlug}
            type="button"
            className="cb-visualizer__btn"
            onClick={() => handlePresetSelect(preset.state)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="cb-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Pascal's triangle for n = ${n}, k = ${kClamped}`}
          draw={draw}
          paused={false}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\binom{${n}}{${kClamped}}=${cDisplay}`,
            `P_{${n},${kClamped}}=${pDisplay}`,
            `\\binom{${n}}{${kClamped}}=\\frac{${n}!}{${kClamped}!(${n}-${kClamped})!}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="cb-visualizer__controls">
        <SliderRow
          label="n (total items)"
          description="Total number of items to choose from."
          min={0}
          max={20}
          step={1}
          value={n}
          onChange={(next) => setState({ ...state, n: next })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="k (chosen)"
          description="How many items are chosen."
          min={0}
          max={20}
          step={1}
          value={k}
          onChange={(next) => setState({ ...state, k: next })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="cb-visualizer__actions">
        <button
          type="button"
          className="cb-visualizer__btn"
          onClick={handleReset}
        >
          ↺ Reset
        </button>
        <span className="cb-visualizer__counter" aria-live="off">
          C({n}, {kClamped}) = {cDisplay}
        </span>
      </div>
    </div>
  );
}
