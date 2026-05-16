/**
 * Named presets for the birthday-paradox visualiser.
 *
 * Each preset captures all share-relevant state so the <PresetCarousel>
 * can swap the entire scenario in one click and <useDemoState> can keep
 * the URL fragment in sync.
 */

export interface BirthdayDemoState {
  daysInYear: number;
  maxN: number;
  target: number;
  stepDelay: number;
}

export interface BirthdayPreset {
  name: string;
  state: BirthdayDemoState;
}

export const DEFAULT_STATE: BirthdayDemoState = {
  daysInYear: 365,
  maxN: 50,
  target: 0.5,
  stepDelay: 200,
};

export const PRESETS: readonly BirthdayPreset[] = [
  {
    name: "Classic (n=23, P=0.5)",
    state: { daysInYear: 365, maxN: 50, target: 0.5, stepDelay: 200 },
  },
  {
    name: "Hash collision (D=256)",
    state: { daysInYear: 256, maxN: 40, target: 0.5, stepDelay: 200 },
  },
  {
    name: "Big year (D=500)",
    state: { daysInYear: 500, maxN: 80, target: 0.5, stepDelay: 150 },
  },
  {
    name: "High target (0.99)",
    state: { daysInYear: 365, maxN: 80, target: 0.99, stepDelay: 150 },
  },
] as const;
