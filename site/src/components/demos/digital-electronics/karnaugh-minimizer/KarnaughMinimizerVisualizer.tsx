import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type Cube, cubeToTerm, minimize } from "./algorithm";
import {
  DEFAULT_STATE,
  PRESET_META,
  PRESET_SLUGS,
  PRESETS,
  type PresetSlug,
} from "./presets";
import "./KarnaughMinimizerVisualizer.css";

/**
 * <KarnaughMinimizerVisualizer> — interactive K-map + Quine-McCluskey
 * visualiser for the Digital Electronics demo (#116).
 *
 * Renders the truth table as a Gray-coded K-map grid (cells coloured by
 * value), overlays each prime implicant cube as a rounded rectangle, and
 * prints the resulting sum-of-products expression.
 */

const VAR_NAMES = ["A", "B", "C", "D"] as const;
const CUBE_COLORS = ["#d04a55", "#3a7bd5", "#e08b1a", "#7a3fbf", "#1aa28a", "#c43c8b"] as const;
const CELL_SIZE = 56;
const CELL_GAP = 6;
const PAD = 38;

const STATE_SCHEMA = {
  nVars: { type: "number", default: DEFAULT_STATE.nVars },
  preset: { type: "enum", default: "and-gate", values: PRESET_SLUGS },
} as const satisfies Schema;

type StateShape = { nVars: number; preset: PresetSlug };

/** 2-bit Gray code sequence. 1-bit axis collapses to [0, 1]. */
const GRAY_2BIT = [0, 1, 3, 2] as const;

function axisGray(bits: number): readonly number[] {
  if (bits <= 0) return [0];
  if (bits === 1) return [0, 1];
  return GRAY_2BIT;
}

interface GridLayout {
  rowBits: number;
  colBits: number;
  rows: number;
  cols: number;
  rowGray: readonly number[];
  colGray: readonly number[];
  rowVars: readonly string[];
  colVars: readonly string[];
}

function layoutFor(nVars: number): GridLayout {
  if (nVars === 2) {
    return {
      rowBits: 1,
      colBits: 1,
      rows: 2,
      cols: 2,
      rowGray: axisGray(1),
      colGray: axisGray(1),
      rowVars: ["A"],
      colVars: ["B"],
    };
  }
  if (nVars === 3) {
    return {
      rowBits: 1,
      colBits: 2,
      rows: 2,
      cols: 4,
      rowGray: axisGray(1),
      colGray: axisGray(2),
      rowVars: ["A"],
      colVars: ["B", "C"],
    };
  }
  // nVars === 4
  return {
    rowBits: 2,
    colBits: 2,
    rows: 4,
    cols: 4,
    rowGray: axisGray(2),
    colGray: axisGray(2),
    rowVars: ["A", "B"],
    colVars: ["C", "D"],
  };
}

function mintermAt(row: number, col: number, layout: GridLayout): number {
  const rowVal = layout.rowGray[row] ?? 0;
  const colVal = layout.colGray[col] ?? 0;
  return (rowVal << layout.colBits) | colVal;
}

function cubeCovers(cube: Cube, minterm: number, nVars: number): boolean {
  for (let i = 0; i < nVars; i += 1) {
    const bit = (minterm >> (nVars - 1 - i)) & 1 ? "1" : "0";
    const c = cube[i];
    if (c !== "-" && c !== bit) return false;
  }
  return true;
}

interface CellCoverage {
  row: number;
  col: number;
}

function coveredCells(cube: Cube, layout: GridLayout, nVars: number): CellCoverage[] {
  const out: CellCoverage[] = [];
  for (let r = 0; r < layout.rows; r += 1) {
    for (let c = 0; c < layout.cols; c += 1) {
      const m = mintermAt(r, c, layout);
      if (cubeCovers(cube, m, nVars)) out.push({ row: r, col: c });
    }
  }
  return out;
}

function bitsLabel(value: number, bits: number): string {
  if (bits <= 0) return "";
  let s = "";
  for (let i = bits - 1; i >= 0; i -= 1) s += (value >> i) & 1;
  return s;
}

function cellX(col: number): number {
  return PAD + col * (CELL_SIZE + CELL_GAP);
}

function cellY(row: number): number {
  return PAD + row * (CELL_SIZE + CELL_GAP);
}

export default function KarnaughMinimizerVisualizer() {
  const [state, setState, { reset }] = useDemoState<typeof STATE_SCHEMA>(
    "karnaugh-minimizer",
    STATE_SCHEMA,
    { nVars: DEFAULT_STATE.nVars, preset: "and-gate" },
  );

  const typed = state as unknown as StateShape;
  const layout = useMemo(() => layoutFor(typed.nVars), [typed.nVars]);
  const meta = PRESET_META[typed.preset];
  const universe = 1 << typed.nVars;

  const minterms = useMemo(
    () => meta.minterms.filter((m) => m < universe),
    [meta, universe],
  );
  const dontCares = useMemo(
    () => (meta.dontCares ?? []).filter((m) => m < universe),
    [meta, universe],
  );

  const result = useMemo(() => {
    if (minterms.length === 0) return { cubes: [], literalCount: 0 };
    return minimize({
      nVars: typed.nVars,
      minterms,
      ...(dontCares.length > 0 ? { dontCares } : {}),
    });
  }, [typed.nVars, minterms, dontCares]);

  const varNames = VAR_NAMES.slice(0, typed.nVars);
  const expression = useMemo(() => {
    if (result.cubes.length === 0) return "F = 0";
    const terms = result.cubes.map((c) => cubeToTerm(c, varNames));
    return `F = ${terms.join(" + ")}`;
  }, [result.cubes, varNames]);

  const svgWidth = PAD * 2 + layout.cols * CELL_SIZE + (layout.cols - 1) * CELL_GAP;
  const svgHeight = PAD * 2 + layout.rows * CELL_SIZE + (layout.rows - 1) * CELL_GAP;

  const handlePresetSelect = (next: StateShape & { slug?: PresetSlug }): void => {
    const slug = (next as { slug?: PresetSlug }).slug ?? typed.preset;
    setState({ nVars: next.nVars, preset: slug } as typeof state);
  };

  const handleReset = (): void => {
    reset();
  };

  const handleNVarsChange = (nVars: number): void => {
    setState({ ...typed, nVars: Math.round(nVars) } as typeof state);
  };

  const mintermSet = new Set(minterms);
  const dcSet = new Set(dontCares);

  const cubeRects = result.cubes.map((cube, idx) => {
    const cells = coveredCells(cube, layout, typed.nVars);
    if (cells.length === 0) return null;
    let minR = layout.rows;
    let maxR = -1;
    let minC = layout.cols;
    let maxC = -1;
    for (const cell of cells) {
      if (cell.row < minR) minR = cell.row;
      if (cell.row > maxR) maxR = cell.row;
      if (cell.col < minC) minC = cell.col;
      if (cell.col > maxC) maxC = cell.col;
    }
    const inset = 3 + idx * 1.5;
    const x = cellX(minC) - inset;
    const y = cellY(minR) - inset;
    const w =
      (maxC - minC + 1) * CELL_SIZE + (maxC - minC) * CELL_GAP + inset * 2;
    const h =
      (maxR - minR + 1) * CELL_SIZE + (maxR - minR) * CELL_GAP + inset * 2;
    const color = CUBE_COLORS[idx % CUBE_COLORS.length];
    return { key: idx, x, y, w, h, color, term: cubeToTerm(cube, varNames) };
  });

  return (
    <div className="km-visualizer">
      <PresetCarousel
        presets={
          PRESETS as unknown as {
            name: string;
            state: typeof state;
          }[]
        }
        onSelect={handlePresetSelect as (next: typeof state) => void}
        ariaLabel="Karnaugh-map presets"
      />

      <div className="km-visualizer__stage">
        <div className="km-visualizer__panel">
          <p className="km-visualizer__panel-title">K-map</p>
          <svg
            className="km-visualizer__svg"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            role="img"
            aria-label={`K-map for ${typed.nVars} variables`}
          >
            {/* Column axis label */}
            <text
              className="km-visualizer__axis-label"
              x={PAD + (layout.cols * (CELL_SIZE + CELL_GAP) - CELL_GAP) / 2}
              y={PAD / 2}
            >
              {layout.colVars.join("")}
            </text>
            {/* Row axis label */}
            <text
              className="km-visualizer__axis-label"
              x={PAD / 2}
              y={PAD + (layout.rows * (CELL_SIZE + CELL_GAP) - CELL_GAP) / 2}
            >
              {layout.rowVars.join("")}
            </text>
            {/* Column headers (Gray) */}
            {Array.from({ length: layout.cols }, (_, c) => (
              <text
                key={`ch-${c}`}
                className="km-visualizer__axis-label"
                x={cellX(c) + CELL_SIZE / 2}
                y={PAD - 8}
              >
                {bitsLabel(layout.colGray[c] ?? 0, layout.colBits)}
              </text>
            ))}
            {/* Row headers (Gray) */}
            {Array.from({ length: layout.rows }, (_, r) => (
              <text
                key={`rh-${r}`}
                className="km-visualizer__axis-label"
                x={PAD - 10}
                y={cellY(r) + CELL_SIZE / 2}
              >
                {bitsLabel(layout.rowGray[r] ?? 0, layout.rowBits)}
              </text>
            ))}
            {/* Cells */}
            {Array.from({ length: layout.rows }, (_, r) =>
              Array.from({ length: layout.cols }, (_, c) => {
                const m = mintermAt(r, c, layout);
                const isMin = mintermSet.has(m);
                const isDc = dcSet.has(m);
                const cls = isMin
                  ? "km-visualizer__cell-one"
                  : isDc
                    ? "km-visualizer__cell-dc"
                    : "km-visualizer__cell-zero";
                const label = isMin ? "1" : isDc ? "X" : "0";
                return (
                  <g key={`cell-${r}-${c}`}>
                    <rect
                      className={cls}
                      x={cellX(c)}
                      y={cellY(r)}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      rx={3}
                      ry={3}
                    />
                    <text
                      className="km-visualizer__cell-label"
                      x={cellX(c) + CELL_SIZE / 2}
                      y={cellY(r) + CELL_SIZE / 2 - 6}
                    >
                      {label}
                    </text>
                    <text
                      className="km-visualizer__cell-label"
                      x={cellX(c) + CELL_SIZE / 2}
                      y={cellY(r) + CELL_SIZE / 2 + 10}
                      style={{ fill: "#888", fontSize: 9 }}
                    >
                      m{m}
                    </text>
                  </g>
                );
              }),
            )}
            {/* Cube overlays */}
            {cubeRects.map((rect) =>
              rect === null ? null : (
                <rect
                  key={`cube-${rect.key}`}
                  className="km-visualizer__cube-overlay"
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  rx={10}
                  ry={10}
                  stroke={rect.color}
                />
              ),
            )}
          </svg>
          <div className="km-visualizer__cube-legend">
            {cubeRects.map((rect) =>
              rect === null ? null : (
                <span
                  className="km-visualizer__cube-legend-item"
                  key={`leg-${rect.key}`}
                  style={{ color: rect.color }}
                >
                  <span
                    className="km-visualizer__cube-swatch"
                    aria-hidden="true"
                  />
                  <span style={{ color: "#333" }}>{rect.term}</span>
                </span>
              ),
            )}
          </div>
        </div>

        <div className="km-visualizer__panel">
          <p className="km-visualizer__panel-title">Minimized SOP</p>
          <div
            className={
              result.cubes.length === 0
                ? "km-visualizer__expression km-visualizer__expression-empty"
                : "km-visualizer__expression"
            }
          >
            {expression}
          </div>
          <div className="km-visualizer__hud">
            <span className="km-visualizer__hud-item">nVars: {typed.nVars}</span>
            <span className="km-visualizer__hud-item">
              minterms: {minterms.length}
            </span>
            <span className="km-visualizer__hud-item">
              cubes: {result.cubes.length}
            </span>
            <span className="km-visualizer__hud-item">
              literals: {result.literalCount}
            </span>
          </div>
          <p
            className="km-visualizer__panel-title"
            style={{ marginTop: "1rem" }}
          >
            Preset
          </p>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#444" }}>
            {meta.narration}
          </p>
        </div>
      </div>

      <div className="km-visualizer__controls">
        <SliderRow
          label="Variables (nVars)"
          description="Number of input variables. The K-map grows from 2×2 to 4×4."
          min={2}
          max={4}
          step={1}
          value={typed.nVars}
          onChange={handleNVarsChange}
          format={{ precision: 0 }}
        />
      </div>

      <div className="km-visualizer__actions">
        <button
          type="button"
          className="km-visualizer__btn"
          onClick={handleReset}
        >
          ↺ Reset
        </button>
        <span className="km-visualizer__counter" aria-live="off">
          {result.cubes.length} prime cube{result.cubes.length === 1 ? "" : "s"}
          {" · "}
          {result.literalCount} literal{result.literalCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
