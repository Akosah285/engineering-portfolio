import { counterTransition, type Signals } from "./algorithm";

export type PatternSlug =
  | "counter-3bit"
  | "counter-4bit"
  | "shift-register"
  | "toggle-flip-flop";

export const PATTERN_SLUGS: readonly PatternSlug[] = [
  "counter-3bit",
  "counter-4bit",
  "shift-register",
  "toggle-flip-flop",
] as const;

export interface PatternSpec {
  slug: PatternSlug;
  displayName: string;
  cycles: number;
  initial: Signals;
  transition: (prev: Signals) => Signals;
  signalNames: readonly string[];
}

function zeroSignals(names: readonly string[]): Signals {
  const out: Record<string, 0 | 1> = {};
  for (const n of names) out[n] = 0;
  return out;
}

const SHIFT_NAMES = ["q0", "q1", "q2", "q3"] as const;
const shiftTransition = (prev: Signals): Signals => ({
  q0: ((prev.q0 ?? 0) ^ 1) as 0 | 1,
  q1: (prev.q0 ?? 0) as 0 | 1,
  q2: (prev.q1 ?? 0) as 0 | 1,
  q3: (prev.q2 ?? 0) as 0 | 1,
});

const toggleTransition = (prev: Signals): Signals => ({
  q0: ((prev.q0 ?? 0) ^ 1) as 0 | 1,
});

export const PATTERNS: readonly PatternSpec[] = [
  {
    slug: "counter-3bit",
    displayName: "3-bit counter",
    cycles: 8,
    initial: zeroSignals(["q0", "q1", "q2"]),
    transition: counterTransition(3),
    signalNames: ["q0", "q1", "q2"],
  },
  {
    slug: "counter-4bit",
    displayName: "4-bit counter",
    cycles: 16,
    initial: zeroSignals(["q0", "q1", "q2", "q3"]),
    transition: counterTransition(4),
    signalNames: ["q0", "q1", "q2", "q3"],
  },
  {
    slug: "shift-register",
    displayName: "Shift register",
    cycles: 10,
    initial: zeroSignals(SHIFT_NAMES),
    transition: shiftTransition,
    signalNames: ["q0", "q1", "q2", "q3"],
  },
  {
    slug: "toggle-flip-flop",
    displayName: "Toggle FF",
    cycles: 10,
    initial: zeroSignals(["q0"]),
    transition: toggleTransition,
    signalNames: ["q0"],
  },
];

export function getPattern(slug: PatternSlug): PatternSpec {
  const found = PATTERNS.find((p) => p.slug === slug);
  if (!found) {
    const fallback = PATTERNS[0];
    if (!fallback) throw new Error("No VHDL patterns defined");
    return fallback;
  }
  return found;
}

export interface VhdlDemoState {
  cursor: number;
  pattern: PatternSlug;
}

export const DEFAULT_STATE: VhdlDemoState = {
  cursor: 0,
  pattern: "counter-3bit",
};

export const PRESETS: readonly { name: string; state: VhdlDemoState }[] = PATTERNS.map(
  (p) => ({ name: p.displayName, state: { cursor: 0, pattern: p.slug } }),
);
