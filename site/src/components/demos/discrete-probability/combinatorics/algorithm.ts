/**
 * combinatorics — exact C(n,k) and P(n,k) for v4 Combinatorics demo (#73).
 *
 * Uses BigInt internally so the result is exact for any n that fits in
 * memory. Returns BigInt so callers downstream can decide whether to
 * stringify (display) or `Number()` (plot, when small enough).
 *
 * Constraints:
 *   - n, k must be non-negative integers.
 *   - C(n, k) = 0 when k > n (by convention; lets shells render the
 *     full triangle without special-casing).
 */

export function permutations(n: number, k: number): bigint {
  validate(n, k);
  if (k > n) return 0n;
  let result = 1n;
  for (let i = 0n; i < BigInt(k); i += 1n) {
    result *= BigInt(n) - i;
  }
  return result;
}

export function combinations(n: number, k: number): bigint {
  validate(n, k);
  if (k > n) return 0n;
  // Use the smaller side for fewer multiplications.
  const kEff = k > n - k ? n - k : k;
  let num = 1n;
  let den = 1n;
  for (let i = 0n; i < BigInt(kEff); i += 1n) {
    num *= BigInt(n) - i;
    den *= i + 1n;
  }
  return num / den;
}

function validate(n: number, k: number): void {
  if (
    !Number.isInteger(n) ||
    !Number.isInteger(k) ||
    n < 0 ||
    k < 0 ||
    !Number.isFinite(n) ||
    !Number.isFinite(k)
  ) {
    throw new RangeError("combinatorics: n and k must be non-negative integers.");
  }
}
