/**
 * Named presets for the maze-pathfinding visualiser (#108).
 *
 * Each preset is a snapshot of all share-relevant state so consumers can
 * jump to any preset via <PresetCarousel> and the URL fragment stays in
 * sync via <useDemoState>.
 */

export type AlgorithmSlug = "bfs" | "astar";
export type GridSlug = "5" | "10" | "15";

export interface MazePathfindDemoState {
  algorithm: AlgorithmSlug;
  grid: GridSlug;
  wallDensity: number;
  seed: number;
}

export interface MazePathfindPreset {
  name: string;
  state: MazePathfindDemoState;
}

export const PRESET_SLUGS = [
  "open-grid-bfs",
  "open-grid-astar",
  "maze-bfs",
  "maze-astar",
] as const;

export type PresetSlug = (typeof PRESET_SLUGS)[number];

export const PRESET_META: Record<PresetSlug, { name: string }> = {
  "open-grid-bfs": { name: "open-grid-bfs" },
  "open-grid-astar": { name: "open-grid-astar" },
  "maze-bfs": { name: "maze-bfs" },
  "maze-astar": { name: "maze-astar" },
};

export const DEFAULT_STATE: MazePathfindDemoState = {
  algorithm: "bfs",
  grid: "10",
  wallDensity: 0.25,
  seed: 42,
};

export const PRESETS: readonly MazePathfindPreset[] = [
  {
    name: PRESET_META["open-grid-bfs"].name,
    state: { algorithm: "bfs", grid: "10", wallDensity: 0, seed: 1 },
  },
  {
    name: PRESET_META["open-grid-astar"].name,
    state: { algorithm: "astar", grid: "10", wallDensity: 0, seed: 1 },
  },
  {
    name: PRESET_META["maze-bfs"].name,
    state: { algorithm: "bfs", grid: "15", wallDensity: 0.3, seed: 7 },
  },
  {
    name: PRESET_META["maze-astar"].name,
    state: { algorithm: "astar", grid: "15", wallDensity: 0.3, seed: 7 },
  },
] as const;
