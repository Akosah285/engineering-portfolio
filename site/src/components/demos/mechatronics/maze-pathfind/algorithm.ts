// Maze pathfinding via BFS (shortest path on unweighted grid) and A*
// (Manhattan-heuristic optimal).  Used by the v8 Mechatronics maze
// pathfinding demo (#108).
//
// Grid model:  rows × cols of cells; cell.passable boolean.  Coordinates
// are (row, col) with origin at top-left.  Diagonal movement disabled
// (4-connected).  Returns the path as a sequence of cells from start to
// goal inclusive, plus the visit order so the demo can animate.

export interface Cell {
  readonly row: number;
  readonly col: number;
}

export interface Maze {
  readonly rows: number;
  readonly cols: number;
  readonly passable: readonly (readonly boolean[])[];
}

export interface PathResult {
  readonly path: Cell[];
  readonly visitedOrder: Cell[];
  readonly found: boolean;
}

function inBounds(maze: Maze, r: number, c: number): boolean {
  return r >= 0 && r < maze.rows && c >= 0 && c < maze.cols;
}

function passable(maze: Maze, r: number, c: number): boolean {
  return inBounds(maze, r, c) && maze.passable[r]![c]!;
}

function validate(maze: Maze, start: Cell, goal: Cell): void {
  if (maze.rows < 1 || maze.cols < 1) throw new RangeError("maze must have rows>=1, cols>=1.");
  if (maze.passable.length !== maze.rows) {
    throw new RangeError("maze.passable length mismatch with rows.");
  }
  for (const row of maze.passable) {
    if (row.length !== maze.cols) throw new RangeError("maze.passable column count mismatch.");
  }
  if (!inBounds(maze, start.row, start.col)) {
    throw new RangeError("start cell out of bounds.");
  }
  if (!inBounds(maze, goal.row, goal.col)) {
    throw new RangeError("goal cell out of bounds.");
  }
  if (!passable(maze, start.row, start.col)) {
    throw new RangeError("start cell is not passable.");
  }
  if (!passable(maze, goal.row, goal.col)) {
    throw new RangeError("goal cell is not passable.");
  }
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function key(r: number, c: number): string {
  return `${r},${c}`;
}

/** BFS shortest path from start to goal on a 4-connected grid. */
export function bfs(maze: Maze, start: Cell, goal: Cell): PathResult {
  validate(maze, start, goal);
  const visited = new Set<string>();
  const queue: Cell[] = [start];
  const parent = new Map<string, Cell | null>();
  const visitedOrder: Cell[] = [];
  parent.set(key(start.row, start.col), null);
  visited.add(key(start.row, start.col));
  visitedOrder.push(start);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.row === goal.row && cur.col === goal.col) {
      return { path: reconstruct(parent, goal), visitedOrder, found: true };
    }
    for (const [dr, dc] of NEIGHBORS) {
      const nr = cur.row + dr;
      const nc = cur.col + dc;
      if (!passable(maze, nr, nc)) continue;
      const k = key(nr, nc);
      if (visited.has(k)) continue;
      visited.add(k);
      parent.set(k, cur);
      visitedOrder.push({ row: nr, col: nc });
      queue.push({ row: nr, col: nc });
    }
  }
  return { path: [], visitedOrder, found: false };
}

/** Manhattan distance heuristic for A*. */
export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/** A* shortest path (admissible Manhattan heuristic ⇒ optimal). */
export function astar(maze: Maze, start: Cell, goal: Cell): PathResult {
  validate(maze, start, goal);
  const open: { cell: Cell; f: number; g: number }[] = [];
  const gScore = new Map<string, number>();
  const parent = new Map<string, Cell | null>();
  const visitedOrder: Cell[] = [];
  const closed = new Set<string>();
  const startKey = key(start.row, start.col);
  gScore.set(startKey, 0);
  parent.set(startKey, null);
  open.push({ cell: start, g: 0, f: manhattan(start, goal) });
  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const ck = key(current.cell.row, current.cell.col);
    if (closed.has(ck)) continue;
    closed.add(ck);
    visitedOrder.push(current.cell);
    if (current.cell.row === goal.row && current.cell.col === goal.col) {
      return { path: reconstruct(parent, goal), visitedOrder, found: true };
    }
    for (const [dr, dc] of NEIGHBORS) {
      const nr = current.cell.row + dr;
      const nc = current.cell.col + dc;
      if (!passable(maze, nr, nc)) continue;
      const nk = key(nr, nc);
      if (closed.has(nk)) continue;
      const tentativeG = current.g + 1;
      const knownG = gScore.get(nk);
      if (knownG === undefined || tentativeG < knownG) {
        gScore.set(nk, tentativeG);
        parent.set(nk, current.cell);
        open.push({ cell: { row: nr, col: nc }, g: tentativeG, f: tentativeG + manhattan({ row: nr, col: nc }, goal) });
      }
    }
  }
  return { path: [], visitedOrder, found: false };
}

function reconstruct(parent: Map<string, Cell | null>, goal: Cell): Cell[] {
  const out: Cell[] = [];
  let cur: Cell | null = goal;
  while (cur) {
    out.push(cur);
    cur = parent.get(key(cur.row, cur.col)) ?? null;
  }
  out.reverse();
  return out;
}
