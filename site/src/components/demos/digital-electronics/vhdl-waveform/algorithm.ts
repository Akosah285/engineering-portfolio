// VHDL → animated waveform: tiny simulator for synchronous digital traces.
// Reference: Brown & Vranesic, "Fundamentals of Digital Logic with VHDL Design", §7.
//
// A trace consists of a clock signal and a set of named signals whose value at
// each rising clock edge is determined by a pure transition function (Mealy/Moore).
// This brain produces the per-cycle samples in a form that's trivial to render
// as a horizontal stair-step waveform.

export type Bit = 0 | 1;
export type Signals = Readonly<Record<string, Bit>>;

export interface ClockSpec {
  cycles: number;
  startHigh?: boolean;
}

export interface TraceFrame {
  /** Time index in half-cycles (0, 1, 2, ...). */
  half: number;
  clock: Bit;
  /** Signal values held during this half-cycle (sampled at preceding rising edge). */
  signals: Signals;
}

export interface SimulateOptions {
  clock: ClockSpec;
  initial: Signals;
  /** Pure function: given current signals at rising edge, return next-cycle signals. */
  transition: (prev: Signals) => Signals;
}

export function simulate(opts: SimulateOptions): TraceFrame[] {
  const { clock, initial, transition } = opts;
  if (!Number.isInteger(clock.cycles) || clock.cycles < 0) {
    throw new RangeError("simulate: clock.cycles must be a non-negative integer");
  }
  const startHigh = clock.startHigh ?? false;
  const frames: TraceFrame[] = [];
  let cur: Signals = initial;
  for (let c = 0; c < clock.cycles; c++) {
    frames.push({
      half: c * 2,
      clock: startHigh ? 1 : 0,
      signals: cur,
    });
    cur = transition(cur);
    frames.push({
      half: c * 2 + 1,
      clock: startHigh ? 0 : 1,
      signals: cur,
    });
  }
  return frames;
}

export function counterTransition(width: number): (prev: Signals) => Signals {
  if (!Number.isInteger(width) || width <= 0 || width > 16) {
    throw new RangeError("counterTransition: width must be an integer in 1..16");
  }
  return (prev) => {
    let value = 0;
    for (let b = 0; b < width; b++) {
      value |= (prev[`q${b}`] ?? 0) << b;
    }
    value = (value + 1) & ((1 << width) - 1);
    const next: Record<string, Bit> = {};
    for (let b = 0; b < width; b++) {
      next[`q${b}`] = ((value >> b) & 1) as Bit;
    }
    return next;
  };
}

export function projectSignal(frames: TraceFrame[], name: string): Bit[] {
  return frames.map((f) => f.signals[name] ?? 0);
}

export function risingEdges(frames: TraceFrame[], name: string): number[] {
  const edges: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]!.signals[name] ?? 0;
    const cur = frames[i]!.signals[name] ?? 0;
    if (prev === 0 && cur === 1) {
      edges.push(frames[i]!.half);
    }
  }
  return edges;
}
