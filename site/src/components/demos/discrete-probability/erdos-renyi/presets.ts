/**
 * Named presets for the Erdős-Rényi G(n, p) random-graph visualiser.
 *
 * Each preset is a complete snapshot of share-relevant state so that
 * <PresetCarousel> + <useDemoState> can round-trip via the URL fragment.
 *
 * The chosen scenarios walk the user across the famous p ≈ 1/n phase
 * transition: from disconnected dust, through the critical regime, to a
 * single giant component.
 */

export interface ErdosRenyiDemoState {
  nNodes: number;
  p: number;
  seed: number;
}

export interface ErdosRenyiPreset {
  name: string;
  state: ErdosRenyiDemoState;
}

export const DEFAULT_STATE: ErdosRenyiDemoState = {
  nNodes: 50,
  p: 0.05,
  seed: 42,
};

export const PRESETS: readonly ErdosRenyiPreset[] = [
  {
    name: "Sparse (n=20, p=0.05)",
    state: { nNodes: 20, p: 0.05, seed: 42 },
  },
  {
    name: "Near phase transition (n=50, p=0.02)",
    state: { nNodes: 50, p: 0.02, seed: 7 },
  },
  {
    name: "Giant component (n=50, p=0.1)",
    state: { nNodes: 50, p: 0.1, seed: 1 },
  },
  {
    name: "Dense (n=30, p=0.3)",
    state: { nNodes: 30, p: 0.3, seed: 2024 },
  },
  {
    name: "Empty (n=20, p=0)",
    state: { nNodes: 20, p: 0, seed: 1 },
  },
] as const;
