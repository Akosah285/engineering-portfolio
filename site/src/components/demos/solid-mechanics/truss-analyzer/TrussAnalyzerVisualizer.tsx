import { useCallback, useMemo } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { analyze, type Load, type TrussInput, type TrussResult } from "./algorithm";
import {
  ALL_JOINT_IDS,
  DEFAULT_STATE,
  PRESET_META,
  PRESET_SLUGS,
  PRESETS,
  type PresetSlug,
  type ShowZero,
  type TrussAnalyzerDemoState,
} from "./presets";
import "./TrussAnalyzerVisualizer.css";

/**
 * <TrussAnalyzerVisualizer> — React shell around the pure `analyze()`
 * solver in `./algorithm.ts`.  Picks a named geometry, lets the user
 * dial in a load, and renders the resulting axial-force field on a
 * single canvas panel.
 */

const ZERO_FORCE_EPS = 1e-6;

const STATE_SCHEMA = {
  preset: {
    type: "enum",
    default: DEFAULT_STATE.preset,
    values: PRESET_SLUGS,
  },
  loadMag: { type: "number", default: DEFAULT_STATE.loadMag },
  loadJoint: {
    type: "enum",
    default: DEFAULT_STATE.loadJoint,
    values: ALL_JOINT_IDS,
  },
  showZeroMembers: {
    type: "enum",
    default: DEFAULT_STATE.showZeroMembers,
    values: ["show", "hide"] as const,
  },
} as const satisfies Schema;

const SHOW_ZERO_OPTIONS: readonly ShowZero[] = ["hide", "show"];

function narrationTemplate(state: TrussAnalyzerDemoState): string {
  const meta = PRESET_META[state.preset];
  return `${meta.narration} Loading joint ${state.loadJoint} downward at ${state.loadMag.toFixed(1)} kN.`;
}

interface CanvasProjector {
  toCanvas: (x: number, y: number) => readonly [number, number];
  scale: number;
}

function buildProjector(
  joints: readonly { x: number; y: number }[],
  width: number,
  height: number,
  pad: number,
): CanvasProjector {
  const xs = joints.map((j) => j.x);
  const ys = joints.map((j) => j.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = Math.max(1e-6, maxX - minX);
  const dy = Math.max(1e-6, maxY - minY);
  const scale = Math.min((width - 2 * pad) / dx, (height - 2 * pad) / dy);
  const offsetX = (width - dx * scale) / 2 - minX * scale;
  const offsetY = height - ((height - dy * scale) / 2 - minY * scale);
  return {
    scale,
    toCanvas: (x, y) => [x * scale + offsetX, offsetY - y * scale],
  };
}

function memberColor(force: number, maxAbs: number): string {
  if (Math.abs(force) <= ZERO_FORCE_EPS) return "#9aa0a6";
  const t = maxAbs > 0 ? Math.min(1, Math.abs(force) / maxAbs) : 0;
  // Tension = blue, compression = red
  const alpha = 0.35 + 0.6 * t;
  return force > 0
    ? `rgba(40, 90, 200, ${alpha.toFixed(3)})`
    : `rgba(200, 60, 60, ${alpha.toFixed(3)})`;
}

function drawSupport(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  kind: "pin" | "roller-x" | "roller-y",
): void {
  ctx.fillStyle = "#444";
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1.5;
  const s = 10;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - s, cy + s * 1.5);
  ctx.lineTo(cx + s, cy + s * 1.5);
  ctx.closePath();
  ctx.fill();
  if (kind !== "pin") {
    ctx.beginPath();
    ctx.moveTo(cx - s - 2, cy + s * 1.5 + 4);
    ctx.lineTo(cx + s + 2, cy + s * 1.5 + 4);
    ctx.stroke();
  }
}

function drawLoadArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  mag: number,
): void {
  if (Math.abs(mag) < ZERO_FORCE_EPS) return;
  const length = 36;
  ctx.strokeStyle = "#cf4f4f";
  ctx.fillStyle = "#cf4f4f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - length);
  ctx.lineTo(cx, cy - 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - 5, cy - 8);
  ctx.lineTo(cx + 5, cy - 8);
  ctx.closePath();
  ctx.fill();
}

export default function TrussAnalyzerVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "truss-analyzer",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const presetMeta = PRESET_META[state.preset];
  const geometry = presetMeta.geometry;

  // Make sure the chosen loadJoint is actually present in this preset; if
  // the user switched presets via URL, fall back to the preset default.
  const validLoadJoint = useMemo(() => {
    return geometry.joints.some((j) => j.id === state.loadJoint)
      ? state.loadJoint
      : geometry.defaultLoadJoint;
  }, [geometry, state.loadJoint]);

  const trussInput: TrussInput = useMemo(() => {
    const loads: Load[] = [
      { joint: validLoadJoint, Fx: 0, Fy: -state.loadMag },
    ];
    return {
      joints: geometry.joints,
      members: geometry.members,
      supports: geometry.supports,
      loads,
    };
  }, [geometry, validLoadJoint, state.loadMag]);

  const result: TrussResult = useMemo(() => {
    try {
      return analyze(trussInput);
    } catch {
      return { memberForces: [], reactions: [], solvable: false };
    }
  }, [trussInput]);

  const { maxTension, maxCompression, maxAbs } = useMemo(() => {
    let t = 0;
    let c = 0;
    for (const mf of result.memberForces) {
      if (mf.force > t) t = mf.force;
      if (mf.force < c) c = mf.force;
    }
    return { maxTension: t, maxCompression: c, maxAbs: Math.max(t, -c) };
  }, [result]);

  const draw: DrawFn = useCallback(
    (ctx) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#f7f8f6";
      ctx.fillRect(0, 0, width, height);

      const proj = buildProjector(geometry.joints, width, height, 50);
      const jointPos = new Map<string, readonly [number, number]>();
      for (const j of geometry.joints) {
        jointPos.set(j.id, proj.toCanvas(j.x, j.y));
      }

      // Members
      const forceById = new Map<string, number>();
      for (const mf of result.memberForces) {
        forceById.set(`${mf.member.i}|${mf.member.j}`, mf.force);
      }
      for (const mem of geometry.members) {
        const a = jointPos.get(mem.i);
        const b = jointPos.get(mem.j);
        if (!a || !b) continue;
        const force = forceById.get(`${mem.i}|${mem.j}`) ?? 0;
        const isZero = Math.abs(force) <= ZERO_FORCE_EPS;
        if (isZero && state.showZeroMembers === "hide" && result.solvable) {
          continue;
        }
        ctx.strokeStyle = result.solvable ? memberColor(force, maxAbs) : "#666";
        const t = maxAbs > 0 ? Math.min(1, Math.abs(force) / maxAbs) : 0;
        ctx.lineWidth = 2 + 6 * t;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }

      // Supports (drawn under joints)
      for (const sup of geometry.supports) {
        const p = jointPos.get(sup.joint);
        if (!p) continue;
        drawSupport(ctx, p[0], p[1], sup.kind);
      }

      // Joints
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const j of geometry.joints) {
        const p = jointPos.get(j.id);
        if (!p) continue;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#1f2933";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1f2933";
        ctx.fillText(j.id, p[0], p[1]);
      }

      // Load arrow on the loaded joint
      const loadPos = jointPos.get(validLoadJoint);
      if (loadPos) drawLoadArrow(ctx, loadPos[0], loadPos[1], state.loadMag);
    },
    [geometry, result, maxAbs, state.showZeroMembers, validLoadJoint, state.loadMag],
  );

  const handleReset = (): void => {
    reset();
  };

  const handlePresetSelect = (next: TrussAnalyzerDemoState): void => {
    // Force loadJoint to the preset's sensible default whenever we switch.
    const meta = PRESET_META[next.preset];
    setState({ ...next, loadJoint: meta.geometry.defaultLoadJoint });
  };

  // Slider proxies: SliderRow is numeric, but loadJoint and showZeroMembers
  // are enums backed by string state — translate via index.
  const jointIds = geometry.joints.map((j) => j.id);
  const loadJointIdx = Math.max(0, jointIds.indexOf(validLoadJoint));
  const showZeroIdx = SHOW_ZERO_OPTIONS.indexOf(state.showZeroMembers);

  return (
    <div className="tr-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: TrussAnalyzerDemoState }[] as {
            name: string;
            state: TrussAnalyzerDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Truss analyzer presets"
      />

      <div className="tr-visualizer__stage">
        <DemoCanvas
          width={640}
          height={360}
          ariaLabel={`Truss diagram for ${presetMeta.label}`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `J = ${geometry.joints.length},\\; M = ${geometry.members.length}`,
            `T_{max} = ${maxTension.toFixed(2)}\\;kN`,
            `C_{max} = ${Math.abs(maxCompression).toFixed(2)}\\;kN`,
            result.solvable
              ? "\\text{Statically determinate} \\checkmark"
              : "\\text{Indeterminate} \\times",
          ]}
        />
      </div>

      <DemoNarration state={state} template={narrationTemplate} />

      <div className="tr-visualizer__controls">
        <SliderRow
          label="Load magnitude"
          description="Downward force at the selected joint."
          min={0.5}
          max={10}
          step={0.5}
          value={state.loadMag}
          onChange={(loadMag) => setState({ ...state, loadMag })}
          format={{ precision: 1, unit: "kN" }}
        />
        <SliderRow
          label="Load joint"
          description={`Joint receiving the load (${jointIds.join(", ")}).`}
          min={0}
          max={Math.max(0, jointIds.length - 1)}
          step={1}
          value={loadJointIdx}
          onChange={(idx) => {
            const id = jointIds[Math.round(idx)] ?? geometry.defaultLoadJoint;
            setState({ ...state, loadJoint: id });
          }}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Zero members"
          description="Show or hide near-zero force members."
          min={0}
          max={1}
          step={1}
          value={Math.max(0, showZeroIdx)}
          onChange={(idx) => {
            const choice = SHOW_ZERO_OPTIONS[Math.round(idx)] ?? "show";
            setState({ ...state, showZeroMembers: choice });
          }}
          format={{ precision: 0 }}
        />
      </div>

      <div className="tr-visualizer__actions">
        <button type="button" className="tr-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="tr-visualizer__counter" aria-live="off">
          max tension {maxTension.toFixed(2)} kN · max compression{" "}
          {Math.abs(maxCompression).toFixed(2)} kN ·{" "}
          {geometry.members.length} members
        </span>
      </div>
    </div>
  );
}

export { TrussAnalyzerVisualizer };
