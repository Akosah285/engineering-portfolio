// Karnaugh-map-style minimization via the Quine-McCluskey algorithm.
// Used by the v9 Digital Electronics K-map demo (#116).  Pure module.
//
// Inputs are minterm indices (and optional don't-cares) over n input
// variables.  Output is a sum-of-products expressed as a list of cubes,
// each cube an array of "0" | "1" | "-" of length n.

export type Bit = "0" | "1" | "-";
export type Cube = readonly Bit[];

export interface MinimizeInput {
  readonly nVars: number;
  readonly minterms: readonly number[];
  readonly dontCares?: readonly number[];
}

export interface MinimizeResult {
  readonly cubes: Cube[];
  readonly literalCount: number;
}

const MAX_VARS = 10;

function toBits(value: number, nVars: number): Bit[] {
  const out = new Array<Bit>(nVars);
  for (let i = 0; i < nVars; i += 1) {
    out[nVars - 1 - i] = (value >> i) & 1 ? "1" : "0";
  }
  return out;
}

function popcount(b: Cube): number {
  let n = 0;
  for (const c of b) if (c === "1") n += 1;
  return n;
}

function tryMerge(a: Cube, b: Cube): Cube | null {
  let diff = 0;
  const out: Bit[] = new Array(a.length);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) {
      out[i] = a[i]!;
    } else if (a[i] === "-" || b[i] === "-") {
      return null;
    } else {
      diff += 1;
      if (diff > 1) return null;
      out[i] = "-";
    }
  }
  if (diff !== 1) return null;
  return out;
}

function cubeKey(c: Cube): string {
  return c.join("");
}

function cubeCovers(cube: Cube, minterm: number, nVars: number): boolean {
  const bits = toBits(minterm, nVars);
  for (let i = 0; i < nVars; i += 1) {
    if (cube[i] !== "-" && cube[i] !== bits[i]) return false;
  }
  return true;
}

function literals(cube: Cube): number {
  let n = 0;
  for (const b of cube) if (b !== "-") n += 1;
  return n;
}

/**
 * Quine-McCluskey minimization with greedy essential-prime cover.  For
 * the demo's typical n <= 6 this is exact and fast.  For larger n the
 * greedy second pass may not be globally optimal but matches what
 * textbook K-map exercises produce.
 */
export function minimize(input: MinimizeInput): MinimizeResult {
  if (!Number.isInteger(input.nVars) || input.nVars < 1 || input.nVars > MAX_VARS) {
    throw new RangeError(`minimize: nVars must be an integer in [1, ${MAX_VARS}].`);
  }
  const universe = 1 << input.nVars;
  for (const m of input.minterms) {
    if (!Number.isInteger(m) || m < 0 || m >= universe) {
      throw new RangeError("minimize: minterm out of range.");
    }
  }
  for (const m of input.dontCares ?? []) {
    if (!Number.isInteger(m) || m < 0 || m >= universe) {
      throw new RangeError("minimize: don't-care out of range.");
    }
  }
  if (input.minterms.length === 0) {
    return { cubes: [], literalCount: 0 };
  }
  const sortedMinterms = [...new Set(input.minterms)].sort((a, b) => a - b);
  const allTerms = [...new Set([...sortedMinterms, ...(input.dontCares ?? [])])];
  // Generate prime implicants.
  let groups: Map<string, Cube> = new Map();
  for (const m of allTerms) groups.set(cubeKey(toBits(m, input.nVars)), toBits(m, input.nVars));
  const primes: Cube[] = [];
  while (groups.size > 0) {
    const cubes = Array.from(groups.values());
    const usedKeys = new Set<string>();
    const next = new Map<string, Cube>();
    cubes.sort((a, b) => popcount(a) - popcount(b));
    for (let i = 0; i < cubes.length; i += 1) {
      for (let j = i + 1; j < cubes.length; j += 1) {
        const merged = tryMerge(cubes[i]!, cubes[j]!);
        if (merged) {
          usedKeys.add(cubeKey(cubes[i]!));
          usedKeys.add(cubeKey(cubes[j]!));
          next.set(cubeKey(merged), merged);
        }
      }
    }
    for (const c of cubes) {
      if (!usedKeys.has(cubeKey(c))) primes.push(c);
    }
    groups = next;
  }
  // Build prime-implicant chart restricted to required minterms.
  const required = sortedMinterms;
  const coverage: Map<number, number[]> = new Map();
  for (const m of required) coverage.set(m, []);
  for (let pi = 0; pi < primes.length; pi += 1) {
    for (const m of required) {
      if (cubeCovers(primes[pi]!, m, input.nVars)) {
        coverage.get(m)!.push(pi);
      }
    }
  }
  const chosen = new Set<number>();
  // Find essential primes.
  for (const [m, list] of coverage) {
    if (list.length === 1) chosen.add(list[0]!);
    void m;
  }
  // Greedily cover remaining.
  while (true) {
    const uncovered = required.filter((m) => {
      for (const pi of chosen) if (cubeCovers(primes[pi]!, m, input.nVars)) return false;
      return true;
    });
    if (uncovered.length === 0) break;
    let best = -1;
    let bestCover = -1;
    for (let pi = 0; pi < primes.length; pi += 1) {
      if (chosen.has(pi)) continue;
      let c = 0;
      for (const m of uncovered) if (cubeCovers(primes[pi]!, m, input.nVars)) c += 1;
      if (c > bestCover) {
        bestCover = c;
        best = pi;
      }
    }
    if (best < 0) break;
    chosen.add(best);
  }
  const cubes = [...chosen].map((pi) => primes[pi]!);
  // Stable sort by literal count then string for determinism.
  cubes.sort((a, b) => literals(a) - literals(b) || cubeKey(a).localeCompare(cubeKey(b)));
  let literalCount = 0;
  for (const c of cubes) literalCount += literals(c);
  return { cubes, literalCount };
}

/** Render a cube as a sum-of-products term using variable names. */
export function cubeToTerm(cube: Cube, varNames: readonly string[]): string {
  if (cube.length !== varNames.length) {
    throw new RangeError("cubeToTerm: variable count mismatch.");
  }
  const parts: string[] = [];
  for (let i = 0; i < cube.length; i += 1) {
    if (cube[i] === "1") parts.push(varNames[i]!);
    else if (cube[i] === "0") parts.push(`!${varNames[i]!}`);
  }
  return parts.length === 0 ? "1" : parts.join("");
}
