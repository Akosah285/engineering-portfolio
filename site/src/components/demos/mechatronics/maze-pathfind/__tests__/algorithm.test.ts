import { describe, expect, it } from "vitest";

import { astar, bfs, manhattan, type Maze } from "../algorithm";

function open(rows: number, cols: number): Maze {
  const passable: boolean[][] = Array.from({ length: rows }, () =>
    new Array<boolean>(cols).fill(true),
  );
  return { rows, cols, passable };
}

function withWall(maze: Maze, walls: ReadonlyArray<readonly [number, number]>): Maze {
  const passable = maze.passable.map((row) => row.slice());
  for (const [r, c] of walls) passable[r]![c] = false;
  return { ...maze, passable };
}

describe("manhattan", () => {
  it("is symmetric and zero at the same cell", () => {
    const a = { row: 2, col: 3 };
    const b = { row: 5, col: 1 };
    expect(manhattan(a, b)).toBe(manhattan(b, a));
    expect(manhattan(a, a)).toBe(0);
  });

  it("equals |dr| + |dc|", () => {
    expect(manhattan({ row: 0, col: 0 }, { row: 3, col: 4 })).toBe(7);
  });
});

describe("bfs — open grid", () => {
  it("finds a shortest path on an open 5x5 grid", () => {
    const m = open(5, 5);
    const r = bfs(m, { row: 0, col: 0 }, { row: 4, col: 4 });
    expect(r.found).toBe(true);
    // Manhattan distance + 1 cell is the path length on an unobstructed grid.
    expect(r.path.length).toBe(9);
    // First and last cells correct
    expect(r.path[0]).toEqual({ row: 0, col: 0 });
    expect(r.path[r.path.length - 1]).toEqual({ row: 4, col: 4 });
  });

  it("path is composed of 4-connected steps", () => {
    const m = open(5, 5);
    const r = bfs(m, { row: 0, col: 0 }, { row: 4, col: 4 });
    for (let i = 1; i < r.path.length; i += 1) {
      const dr = Math.abs(r.path[i]!.row - r.path[i - 1]!.row);
      const dc = Math.abs(r.path[i]!.col - r.path[i - 1]!.col);
      expect(dr + dc).toBe(1);
    }
  });
});

describe("bfs — walls and unreachable goals", () => {
  it("routes around a partial wall", () => {
    // Wall along col=2 with one gap at row=4.
    const walls: [number, number][] = [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ];
    const m = withWall(open(5, 5), walls);
    const r = bfs(m, { row: 0, col: 0 }, { row: 0, col: 4 });
    expect(r.found).toBe(true);
    // Direct path length is Manhattan = 4+1 = 5; walled path must detour to row 4
    expect(r.path.length).toBeGreaterThan(5);
  });

  it("returns found=false when the goal is fully walled off", () => {
    // Surround goal completely.
    const walls: [number, number][] = [
      [3, 4],
      [4, 3],
    ];
    const m = withWall(open(5, 5), walls);
    const r = bfs(m, { row: 0, col: 0 }, { row: 4, col: 4 });
    expect(r.found).toBe(false);
    expect(r.path).toEqual([]);
  });
});

describe("astar — equivalence with BFS on unweighted grids", () => {
  it("finds a path of the same length as BFS on open grids", () => {
    const m = open(7, 7);
    const a = astar(m, { row: 0, col: 0 }, { row: 6, col: 6 });
    const b = bfs(m, { row: 0, col: 0 }, { row: 6, col: 6 });
    expect(a.found).toBe(true);
    expect(b.found).toBe(true);
    expect(a.path.length).toBe(b.path.length);
  });

  it("explores fewer or equal cells than BFS on directed paths", () => {
    const m = open(20, 20);
    const a = astar(m, { row: 0, col: 0 }, { row: 19, col: 19 });
    const b = bfs(m, { row: 0, col: 0 }, { row: 19, col: 19 });
    // Manhattan heuristic is admissible; A* should never explore more than BFS
    expect(a.visitedOrder.length).toBeLessThanOrEqual(b.visitedOrder.length);
  });

  it("returns found=false when the goal is unreachable (wall fully separates)", () => {
    // 3x3 maze with middle column entirely walled; start at (0,0), goal at (0,2).
    const walls: [number, number][] = [
      [0, 1],
      [1, 1],
      [2, 1],
    ];
    const m = withWall(open(3, 3), walls);
    const r = astar(m, { row: 0, col: 0 }, { row: 0, col: 2 });
    expect(r.found).toBe(false);
  });
});

describe("validation", () => {
  it("RangeError on out-of-bounds start/goal", () => {
    const m = open(3, 3);
    expect(() => bfs(m, { row: -1, col: 0 }, { row: 0, col: 0 })).toThrow(RangeError);
    expect(() => bfs(m, { row: 0, col: 0 }, { row: 3, col: 0 })).toThrow(RangeError);
  });

  it("RangeError when start or goal is on a wall", () => {
    const m = withWall(open(3, 3), [[0, 0]]);
    expect(() => bfs(m, { row: 0, col: 0 }, { row: 2, col: 2 })).toThrow(RangeError);
  });
});
