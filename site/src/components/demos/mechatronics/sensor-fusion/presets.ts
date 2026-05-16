// Deterministic synthetic IMU traces used by SensorFusionVisualizer.
//
// Each scenario provides a truth angle series (the underlying signal we are
// trying to recover), a gyro angular-velocity series, an accelerometer angle
// series (truth + noise), and the time step dt. Noise is drawn from a fixed
// Mulberry32 PRNG so re-renders are reproducible.

export type ScenarioSlug =
  | "clean-tilt-ramp"
  | "gyro-drift"
  | "noisy-accel"
  | "step-change";

export interface Scenario {
  readonly slug: ScenarioSlug;
  readonly name: string;
  readonly dt: number;
  readonly truth: readonly number[];
  readonly omegaGyro: readonly number[];
  readonly thetaAcc: readonly number[];
  readonly theta0: number;
  readonly defaultAlpha: number;
}

const N = 80;
const DT = 0.02;
const SEED = 12345;

/** Mulberry32 — small, fast, deterministic PRNG (Tommy Ettinger / bryc). */
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

/** Box-Muller transform: pair of u01 samples → standard normal. */
function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function noisy(truth: readonly number[], sigma: number, seedOffset: number): number[] {
  const rand = mulberry32(SEED + seedOffset);
  return truth.map((t) => t + gaussian(rand) * sigma);
}

function buildCleanTiltRamp(): Scenario {
  const truth = Array.from({ length: N }, (_, k) => (k / (N - 1)) * (Math.PI / 3));
  // exact derivative: constant slope dθ/dt = (π/3) / ((N-1)·dt)
  const slope = Math.PI / 3 / ((N - 1) * DT);
  const omegaGyro = Array.from({ length: N }, () => slope);
  const thetaAcc = noisy(truth, 0.05, 1);
  return {
    slug: "clean-tilt-ramp",
    name: "Clean tilt",
    dt: DT,
    truth,
    omegaGyro,
    thetaAcc,
    theta0: truth[0] ?? 0,
    defaultAlpha: 0.95,
  };
}

function buildGyroDrift(): Scenario {
  const truth = Array.from({ length: N }, () => 0);
  // Constant small bias — pure integration would drift linearly.
  const omegaGyro = Array.from({ length: N }, () => 0.005);
  const thetaAcc = noisy(truth, 0.02, 2);
  return {
    slug: "gyro-drift",
    name: "Gyro drift",
    dt: DT,
    truth,
    omegaGyro,
    thetaAcc,
    theta0: 0,
    defaultAlpha: 0.9,
  };
}

function buildNoisyAccel(): Scenario {
  const truth = Array.from({ length: N }, (_, k) => 0.4 * Math.sin(0.1 * k));
  // Exact derivative of 0.4 sin(0.1k) wrt continuous time t = k·dt is
  // 0.4 · (0.1/dt) · cos(0.1k); we treat k as the integer sample index so
  // that integrating ω·dt over samples reproduces the truth series.
  const omegaGyro = Array.from(
    { length: N },
    (_, k) => (0.4 * 0.1 * Math.cos(0.1 * k)) / DT,
  );
  const thetaAcc = noisy(truth, 0.2, 3);
  return {
    slug: "noisy-accel",
    name: "Noisy accel",
    dt: DT,
    truth,
    omegaGyro,
    thetaAcc,
    theta0: truth[0] ?? 0,
    defaultAlpha: 0.98,
  };
}

function buildStepChange(): Scenario {
  const truth = Array.from({ length: N }, (_, k) => (k < 40 ? 0 : 0.5));
  // Piecewise gyro: zero everywhere except a single-sample pulse at k=40
  // that integrates to a 0.5 rad jump.
  const omegaGyro = Array.from({ length: N }, (_, k) => (k === 40 ? 0.5 / DT : 0));
  const thetaAcc = noisy(truth, 0.05, 4);
  return {
    slug: "step-change",
    name: "Step change",
    dt: DT,
    truth,
    omegaGyro,
    thetaAcc,
    theta0: 0,
    defaultAlpha: 0.9,
  };
}

export const SCENARIOS: readonly Scenario[] = [
  buildCleanTiltRamp(),
  buildGyroDrift(),
  buildNoisyAccel(),
  buildStepChange(),
];

export const SCENARIO_SLUGS = SCENARIOS.map((s) => s.slug) as readonly ScenarioSlug[];

export function getScenario(slug: ScenarioSlug): Scenario {
  return SCENARIOS.find((s) => s.slug === slug) ?? SCENARIOS[0]!;
}
