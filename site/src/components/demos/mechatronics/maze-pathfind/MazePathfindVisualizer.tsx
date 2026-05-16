import { useCallback, useMemo, useRef } from "react";
import { DemoCanvas, type DrawFn } from "../../../demo-kit/DemoCanvas";
import { MathHud } from "../../../demo-kit/MathHud";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import {
  astar,
  bfs,
  type Cell,
  type Maze,
  type PathResult,
} from "./algorithm";
import {
  type AlgorithmSlug,
  DEFAULT_STATE,
  type GridSlug,
  type MazePathfindDemoState,
  PRESETS,
} from "./presets";
import "./MazePathfindVisualizer.css";

/**
 * <MazePathfindVisualizer> — wraps the BFS/A* maze algorithm in a
 * canvas + controls shell (plan §4.8, #108).
 */

const ALGORITHMS = ["bfs", "astar"] as const;
const GRIDS = ["5", "10", "15"] as const;

const STATE_SCHEMA = {
  algorithm: { type: "enum", default: DEFAULT_STATE.algorithm, values: ALGORITHMS },
  grid: { type: "enum", default: DEFAULT_STATE.grid, values: GRIDS },
  wallDensity: { type: "number", default: DEFAULT_STATE.wallDensity },
  seed: { type: "number", default: DEFAULT_STATE.seed },
} as const satisfies Schema;

const CELLS_PER_SECOND = 50;
const CANVAS_SIZE = 420;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMaze(size: number, wallDensity: number, seed: number): Maze {
  const prng = mulberry32(seed);
  const passable: boolean[][] = [];
  for (let r = 0; r < size; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c += 1) {
      const isBorder = r === 0 || c === 0 || r === size - 1 || c === size - 1;
      row.push(isBorder ? true : prng() > wallDensity);
    }
    passable.push(row);
  }
  // Force start & goal passable
  passable[0]![0] = true;
  passable[size - 1]![size - 1] = true;
  return { rows: size, cols: size, passable };
}

function runAlgorithm(
  algorithm: AlgorithmSlug,
  maze: Maze,
  start: Cell,
  goal: Cell,
): PathResult {
  return algorithm === "bfs" ? bfs(maze, start, goal) : astar(maze, start, goal);
}

export function MazePathfindVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "maze-pathfind",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const size = Number.parseInt(state.grid, 10);
  const start: Cell = { row: 0, col: 0 };
  const goal: Cell = { row: size - 1, col: size - 1 };

  const maze = useMemo(
    () => buildMaze(size, state.wallDensity, state.seed),
    [size, state.wallDensity, state.seed],
  );

  const result = useMemo(
    () => runAlgorithm(state.algorithm, maze, start, goal),
    // start/goal are derived from `size`, which is in the dep list via `maze`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.algorithm, maze],
  );

  // Animation progress is per-frame; we use refs so React doesn't re-render
  // on each tick. Reset whenever any input changes.
  const progressRef = useRef(0);
  const accumulatorRef = useRef(0);
  const lastResultRef = useRef<PathResult>(result);
  if (lastResultRef.current !== result) {
    lastResultRef.current = result;
    progressRef.current = 0;
    accumulatorRef.current = 0;
  }

  const draw: DrawFn = useCallback(
    (ctx, deltaMs) => {
      const { width, height } = ctx.canvas;
      const cellW = width / size;
      const cellH = height / size;

      // Advance animation progress
      const stepInterval = 1000 / CELLS_PER_SECOND;
      accumulatorRef.current += deltaMs;
      const stepsThisFrame = Math.floor(accumulatorRef.current / stepInterval);
      if (stepsThisFrame > 0) {
        accumulatorRef.current -= stepsThisFrame * stepInterval;
        progressRef.current = Math.min(
          result.visitedOrder.length,
          progressRef.current + stepsThisFrame,
        );
      }

      // Grid background
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          const isPassable = maze.passable[r]![c]!;
          ctx.fillStyle = isPassable ? "#f4f1ea" : "#2a2724";
          ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
        }
      }

      // Visited overlay (progressive)
      ctx.fillStyle = "rgba(102, 161, 196, 0.55)";
      const visitedCount = progressRef.current;
      for (let i = 0; i < visitedCount; i += 1) {
        const cell = result.visitedOrder[i];
        if (!cell) continue;
        ctx.fillRect(cell.col * cellW, cell.row * cellH, cellW, cellH);
      }

      // Path overlay (once visited animation completes)
      if (progressRef.current >= result.visitedOrder.length && result.path.length > 0) {
        ctx.fillStyle = "rgba(240, 196, 25, 0.85)";
        for (const cell of result.path) {
          ctx.fillRect(cell.col * cellW, cell.row * cellH, cellW, cellH);
        }
      }

      // Grid lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= size; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(width, i * cellH);
        ctx.stroke();
      }

      // Start (S) and Goal (G) markers
      const labelSize = Math.max(10, Math.min(cellW, cellH) * 0.55);
      ctx.font = `bold ${labelSize}px "Inter Variable", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#2e8540";
      ctx.fillRect(0, 0, cellW, cellH);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("S", cellW / 2, cellH / 2);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect((size - 1) * cellW, (size - 1) * cellH, cellW, cellH);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("G", (size - 0.5) * cellW, (size - 0.5) * cellH);
    },
    [maze, result, size],
  );

  const handleReset = (): void => {
    reset();
    progressRef.current = 0;
    accumulatorRef.current = 0;
  };

  const handlePresetSelect = (next: MazePathfindDemoState): void => {
    setState(next);
  };

  const algoIndex = ALGORITHMS.indexOf(state.algorithm);
  const gridIndex = GRIDS.indexOf(state.grid);

  return (
    <div className="mp-visualizer">
      <PresetCarousel
        presets={
          PRESETS as readonly { name: string; state: MazePathfindDemoState }[] as {
            name: string;
            state: MazePathfindDemoState;
          }[]
        }
        onSelect={handlePresetSelect}
        ariaLabel="Maze pathfind presets"
      />

      <div className="mp-visualizer__stage">
        <DemoCanvas
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          ariaLabel={`Maze pathfinding with ${state.algorithm.toUpperCase()} on a ${size}×${size} grid`}
          draw={draw}
        />
        <MathHud
          corner="top-right"
          lines={[
            `\\text{algo} = \\text{${state.algorithm.toUpperCase()}}`,
            `\\text{grid} = ${size}\\times${size}`,
            `\\text{visited} = ${result.visitedOrder.length}`,
            `\\text{path} = ${result.path.length}`,
            `\\text{found} = \\text{${result.found ? "yes" : "no"}}`,
          ]}
        />
      </div>

      <div className="mp-visualizer__controls">
        <SliderRow
          label="Algorithm (BFS / A*)"
          description="0 = BFS shortest path; 1 = A* with Manhattan heuristic."
          min={0}
          max={ALGORITHMS.length - 1}
          step={1}
          value={algoIndex < 0 ? 0 : algoIndex}
          onChange={(next) => {
            const idx = Math.max(0, Math.min(ALGORITHMS.length - 1, Math.round(next)));
            setState({ ...state, algorithm: ALGORITHMS[idx]! });
          }}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Grid size"
          description="Square grid side length: 5×5, 10×10, or 15×15."
          min={0}
          max={GRIDS.length - 1}
          step={1}
          value={gridIndex < 0 ? 0 : gridIndex}
          onChange={(next) => {
            const idx = Math.max(0, Math.min(GRIDS.length - 1, Math.round(next)));
            setState({ ...state, grid: GRIDS[idx]! });
          }}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Wall density"
          description="Probability that an interior cell is a wall."
          min={0}
          max={0.5}
          step={0.05}
          value={state.wallDensity}
          onChange={(wallDensity) => setState({ ...state, wallDensity })}
          format={{ precision: 2 }}
        />
        <SliderRow
          label="Seed"
          description="PRNG seed for the deterministic random maze."
          min={0}
          max={9999}
          step={1}
          value={state.seed}
          onChange={(seed) => setState({ ...state, seed })}
          format={{ precision: 0 }}
        />
      </div>

      <div className="mp-visualizer__actions">
        <button type="button" className="mp-visualizer__btn" onClick={handleReset}>
          ↺ Reset
        </button>
        <span className="mp-visualizer__counter" aria-live="off">
          visited {result.visitedOrder.length} cells · path len {result.path.length}
        </span>
      </div>
    </div>
  );
}

export default MazePathfindVisualizer;
