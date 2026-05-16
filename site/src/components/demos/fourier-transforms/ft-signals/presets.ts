/**
 * Named presets for the Fourier-transform signals visualiser.
 *
 * Each preset is a snapshot of all share-relevant state, so consumers can
 * jump to any preset via <PresetCarousel> and the URL fragment stays in
 * sync via <useDemoState>.
 */

import type { SignalKind } from "./algorithm";

export const SIGNAL_KINDS: readonly SignalKind[] = [
  "rect",
  "triangle",
  "exp-two-sided",
  "exp-causal",
  "gaussian",
] as const;

export interface FtSignalsDemoState {
  signalKind: SignalKind;
  param: number;
  omegaMax: number;
}

export interface FtSignalsPreset {
  name: string;
  state: FtSignalsDemoState;
}

export const DEFAULT_STATE: FtSignalsDemoState = {
  signalKind: "rect",
  param: 1,
  omegaMax: 20,
};

export const PRESETS: readonly FtSignalsPreset[] = [
  {
    name: "Rect (T=1)",
    state: { signalKind: "rect", param: 1, omegaMax: 20 },
  },
  {
    name: "Triangle (T=2)",
    state: { signalKind: "triangle", param: 2, omegaMax: 20 },
  },
  {
    name: "Two-sided exp (a=1)",
    state: { signalKind: "exp-two-sided", param: 1, omegaMax: 10 },
  },
  {
    name: "Causal exp (a=1)",
    state: { signalKind: "exp-causal", param: 1, omegaMax: 10 },
  },
  {
    name: "Gaussian (a=1)",
    state: { signalKind: "gaussian", param: 1, omegaMax: 10 },
  },
] as const;

export interface SignalMeta {
  readonly label: string;
  readonly paramLabel: string;
  readonly timeExpr: string;
  readonly freqExpr: string;
}

export const SIGNAL_META: Record<SignalKind, SignalMeta> = {
  rect: {
    label: "Rectangular pulse",
    paramLabel: "T",
    timeExpr: "f(t) = rect(t/T)",
    freqExpr: "F(ω) = T · sinc(ωT/2)",
  },
  triangle: {
    label: "Triangular pulse",
    paramLabel: "T",
    timeExpr: "f(t) = tri(t/T)",
    freqExpr: "F(ω) = (T/2) · sinc²(ωT/4)",
  },
  "exp-two-sided": {
    label: "Two-sided exponential",
    paramLabel: "a",
    timeExpr: "f(t) = e^(-a|t|)",
    freqExpr: "F(ω) = 2a / (a² + ω²)",
  },
  "exp-causal": {
    label: "Causal exponential",
    paramLabel: "a",
    timeExpr: "f(t) = e^(-at) · u(t)",
    freqExpr: "F(ω) = 1 / (a + iω)",
  },
  gaussian: {
    label: "Gaussian",
    paramLabel: "a",
    timeExpr: "f(t) = e^(-at²)",
    freqExpr: "F(ω) = √(π/a) · e^(-ω²/4a)",
  },
};
