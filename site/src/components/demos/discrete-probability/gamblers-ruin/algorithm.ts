// Gambler's Ruin: random walk on {0, 1, ..., N}, start at k, win prob p.
// Absorbing barriers at 0 (ruin) and N (target).
//
// Analytical ruin probability (probability of hitting 0 before N starting at k):
//   p = q  (fair):    P_ruin(k) = 1 - k/N
//   p ≠ q:            P_ruin(k) = (r^k - r^N) / (1 - r^N), where r = q/p
//
// Reference: Ross, Introduction to Probability Models, §4.5.

export interface RuinInput {
  readonly N: number;
  readonly k: number;
  readonly p: number;
}

function validate({ N, k, p }: RuinInput): void {
  if (!Number.isInteger(N) || N < 1) throw new RangeError("N must be a positive integer");
  if (!Number.isInteger(k) || k < 0 || k > N) {
    throw new RangeError("k must be an integer in [0, N]");
  }
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new RangeError("p must be in [0, 1]");
  }
}

export function ruinProb({ N, k, p }: RuinInput): number {
  validate({ N, k, p });
  if (k === 0) return 1;
  if (k === N) return 0;
  if (p === 0) return 1;
  if (p === 1) return 0;
  if (Math.abs(p - 0.5) < 1e-12) {
    return 1 - k / N;
  }
  const r = (1 - p) / p;
  // (r^k - r^N) / (1 - r^N)
  const numerator = r ** k - r ** N;
  const denominator = 1 - r ** N;
  return numerator / denominator;
}

// Expected number of steps until absorption from state k.
// Fair (p = 1/2):  E[T_k] = k * (N - k)
// Otherwise:       E[T_k] = (1 / (q - p)) * (k - N * (1 - r^k) / (1 - r^N))
export function expectedDuration({ N, k, p }: RuinInput): number {
  validate({ N, k, p });
  if (k === 0 || k === N) return 0;
  if (Math.abs(p - 0.5) < 1e-12) return k * (N - k);
  const q = 1 - p;
  const r = q / p;
  return (1 / (q - p)) * (k - (N * (1 - r ** k)) / (1 - r ** N));
}

// Simulate a single trajectory: returns terminal state (0 or N) + step count.
export function simulate(
  input: RuinInput,
  rng: () => number = Math.random,
): { terminal: 0 | number; steps: number } {
  validate(input);
  const { N, p } = input;
  let s = input.k;
  let steps = 0;
  const cap = 10 * N * N + 1_000_000;
  while (s !== 0 && s !== N) {
    if (rng() < p) s += 1;
    else s -= 1;
    steps += 1;
    if (steps > cap) {
      throw new Error("simulation exceeded safety cap");
    }
  }
  return { terminal: s === 0 ? 0 : s, steps };
}
