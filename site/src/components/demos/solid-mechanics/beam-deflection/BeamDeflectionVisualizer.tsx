import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  type BeamCase,
  type BeamInput,
  deflectionCurve,
  maxDeflection,
} from "./algorithm";
import {
  type BeamCaseSlug,
  type BeamDemoState,
  CASE_LABELS,
  CASE_SLUGS,
  DEFAULT_STATE,
  PRESETS,
} from "./presets";
import "./BeamDeflectionVisualizer.css";

/**
 * <BeamDeflectionVisualizer> — closed-form beam deflection visualisation (#88).
 */

const STATE_SCHEMA = {
  caseSlug: { type: "enum", default: DEFAULT_STATE.caseSlug, values: CASE_SLUGS },
  L: { type: "number", default: DEFAULT_STATE.L },
  E_GPa: { type: "number", default: DEFAULT_STATE.E_GPa },
  I_cm4: { type: "number", default: DEFAULT_STATE.I_cm4 },
  P_or_w: { type: "number", default: DEFAULT_STATE.P_or_w },
} as const satisfies Schema;

function buildLoad(caseSlug: BeamCaseSlug, load_N: number): BeamCase {
  switch (caseSlug) {
    case "cantilever-point":
      return { kind: "cantilever-point", P: load_N };
    case "cantilever-udl":
      return { kind: "cantilever-udl", w: load_N };
    case "simply-supported-point":
      return { kind: "simply-supported-point", P: load_N };
    case "simply-supported-udl":
      return { kind: "simply-supported-udl", w: load_N };
  }
}

const narrationTemplate = (s: BeamDemoState): string => {
  const label = CASE_LABELS[s.caseSlug];
  const E_Pa = s.E_GPa * 1e9;
  const I_m4 = s.I_cm4 * 1e-8;
  const load_N = s.P_or_w * 1000;
  const input: BeamInput = {
    L: s.L,
    E: E_Pa,
    I: I_m4,
    load: buildLoad(s.caseSlug, load_N),
  };
  const vmax = maxDeflection(input);
  const v_max_mm = Math.abs(vmax.v) * 1000;
  return `${label}, L = ${s.L.toFixed(1)} m, E = ${s.E_GPa} GPa, I = ${s.I_cm4} cm⁴. Max deflection ${v_max_mm.toFixed(2)} mm at x = ${vmax.x.toFixed(2)} m.`;
};

export function BeamDeflectionVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "beam-deflection",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const { input, vmax, v_max_mm, curve, caseLabel } = useMemo(() => {
    const E_Pa = state.E_GPa * 1e9;
    const I_m4 = state.I_cm4 * 1e-8;
    const load_N = state.P_or_w * 1000;
    const load = buildLoad(state.caseSlug, load_N);
    const input: BeamInput = { L: state.L, E: E_Pa, I: I_m4, load };
    const vmax = maxDeflection(input);
    const curve = deflectionCurve(input, 100);
    return {
      input,
      vmax,
      v_max_mm: Math.abs(vmax.v) * 1000,
      curve,
      caseLabel: CASE_LABELS[state.caseSlug],
    };
  }, [state.caseSlug, state.L, state.E_GPa, state.I_cm4, state.P_or_w]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);

      const padX = 60;
      const padY = 40;
      const drawW = width - padX * 2;
      const midY = height / 2;
      const L = input.L;

      // Amplification: scale so v_max occupies ~25% of half-height.
      const maxAbs = Math.max(
        ...curve.map((p) => Math.abs(p.v)),
        Number.EPSILON,
      );
      const maxPx = (height / 2 - padY) * 0.6;
      const amp = maxPx / maxAbs;

      const toX = (x: number): number => padX + (x / L) * drawW;
      // Positive v is upward; canvas Y is down. Down-deflection (v<0) renders below midY.
      const toY = (v: number): number => midY - v * amp;

      // Supports
      ctx.strokeStyle = "#333";
      ctx.fillStyle = "#333";
      ctx.lineWidth = 2;
      if (input.load.kind.startsWith("cantilever")) {
        // Wall hatch at x=0
        const wallX = padX;
        ctx.beginPath();
        ctx.moveTo(wallX, midY - 40);
        ctx.lineTo(wallX, midY + 40);
        ctx.stroke();
        for (let y = midY - 40; y <= midY + 40; y += 8) {
          ctx.beginPath();
          ctx.moveTo(wallX - 10, y + 6);
          ctx.lineTo(wallX, y);
          ctx.stroke();
        }
      } else {
        // Pin (triangle) at x=0, roller (triangle) at x=L
        const tri = (cx: number) => {
          ctx.beginPath();
          ctx.moveTo(cx, midY + 4);
          ctx.lineTo(cx - 10, midY + 20);
          ctx.lineTo(cx + 10, midY + 20);
          ctx.closePath();
          ctx.fill();
        };
        tri(toX(0));
        tri(toX(L));
      }

      // Undeformed centerline (dashed black)
      ctx.save();
      ctx.strokeStyle = "#000";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(toX(0), midY);
      ctx.lineTo(toX(L), midY);
      ctx.stroke();
      ctx.restore();

      // Deformed curve (steelblue)
      ctx.strokeStyle = "steelblue";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < curve.length; i += 1) {
        const p = curve[i]!;
        const cx = toX(p.x);
        const cy = toY(p.v);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      // Load arrows
      ctx.strokeStyle = "#b34700";
      ctx.fillStyle = "#b34700";
      ctx.lineWidth = 1.5;
      const drawArrow = (cx: number, length = 22) => {
        const top = midY - length - 14;
        const tip = midY - 14;
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.lineTo(cx, tip);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, tip + 4);
        ctx.lineTo(cx - 4, tip - 2);
        ctx.lineTo(cx + 4, tip - 2);
        ctx.closePath();
        ctx.fill();
      };
      if (input.load.kind === "cantilever-point") {
        drawArrow(toX(L));
      } else if (input.load.kind === "simply-supported-point") {
        drawArrow(toX(L / 2));
      } else {
        // UDL — series of small arrows
        const n = 9;
        for (let i = 0; i <= n; i += 1) {
          drawArrow(toX((i / n) * L), 14);
        }
      }

      // v_max marker
      const mx = toX(vmax.x);
      const my = toY(vmax.v);
      ctx.fillStyle = "#cf4f4f";
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#333";
      ctx.font = "12px 'JetBrains Mono Variable', monospace";
      ctx.fillText(`v_max = ${v_max_mm.toFixed(2)} mm`, mx + 8, my + 4);
    },
    [input, curve, vmax, v_max_mm],
  );

  const handlePresetSelect = (next: typeof state): void => {
    setState(next);
  };

  return (
    <div className="bd-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: typeof DEFAULT_STATE }[] as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Beam deflection presets"
      />

      <div className="bd-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Deflected ${caseLabel} beam`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{${caseLabel}}`,
            `v_{max} = ${v_max_mm.toFixed(2)} \\text{ mm}`,
            `x_{max} = ${vmax.x.toFixed(2)} \\text{ m}`,
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="bd-visualizer__controls">
        <SliderRow
          label="L (length)"
          min={0.5}
          max={5}
          step={0.1}
          value={state.L}
          onChange={(L) => setState({ ...state, L })}
          format={{ precision: 1, unit: "m" }}
        />
        <SliderRow
          label="E (GPa)"
          min={50}
          max={300}
          step={10}
          value={state.E_GPa}
          onChange={(E_GPa) => setState({ ...state, E_GPa })}
          format={{ precision: 0, unit: "GPa" }}
        />
        <SliderRow
          label="I (cm⁴)"
          min={10}
          max={10000}
          step={10}
          value={state.I_cm4}
          onChange={(I_cm4) => setState({ ...state, I_cm4 })}
          format={{ precision: 0, unit: "cm⁴" }}
        />
        <SliderRow
          label="P or w"
          min={0.1}
          max={50}
          step={0.1}
          value={state.P_or_w}
          onChange={(P_or_w) => setState({ ...state, P_or_w })}
          format={{ precision: 1, unit: "kN or kN/m" }}
        />
      </div>

      <div className="bd-visualizer__actions">
        <button type="button" className="bd-visualizer__btn" onClick={reset}>
          ↺ Reset
        </button>
        <span className="bd-visualizer__counter" aria-live="off">
          v_max = {v_max_mm.toFixed(2)} mm
        </span>
      </div>
    </div>
  );
}
