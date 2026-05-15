// Synchronous binary counter (modulo 2^N) with optional carry-out.
// Used by the v9 Digital Electronics counter demo (#118).  Pure module:
// each tick advances the count, and the bit-trace helper exposes per-bit
// waveforms so the demo can plot them as classic FF outputs.

export interface CounterState {
  readonly count: number;
  readonly bits: number;
}

export function makeCounter(bits: number, initial = 0): CounterState {
  if (!Number.isInteger(bits) || bits < 1 || bits > 32) {
    throw new RangeError("makeCounter: bits must be an integer in [1, 32].");
  }
  if (!Number.isInteger(initial) || initial < 0 || initial >= 2 ** bits) {
    throw new RangeError("makeCounter: initial must be in [0, 2^bits).");
  }
  return { count: initial, bits };
}

export interface TickResult {
  readonly state: CounterState;
  readonly carry: boolean;
}

/** Increment by one (synchronous edge); wraps at 2^bits. */
export function tick(state: CounterState): TickResult {
  const max = 2 ** state.bits;
  const next = (state.count + 1) % max;
  const carry = next === 0;
  return { state: { count: next, bits: state.bits }, carry };
}

/** Decrement by one; wraps at 0 to 2^bits-1. */
export function tickDown(state: CounterState): TickResult {
  const max = 2 ** state.bits;
  const next = (state.count - 1 + max) % max;
  const borrow = state.count === 0;
  return { state: { count: next, bits: state.bits }, carry: borrow };
}

/** Hard reset to 0. */
export function reset(state: CounterState): CounterState {
  return { count: 0, bits: state.bits };
}

/** Synchronous parallel load. */
export function load(state: CounterState, value: number): CounterState {
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** state.bits) {
    throw new RangeError("load: value out of range for this counter width.");
  }
  return { count: value, bits: state.bits };
}

/** Bit `b` of the count (0 = LSB). */
export function bit(state: CounterState, b: number): 0 | 1 {
  if (!Number.isInteger(b) || b < 0 || b >= state.bits) {
    throw new RangeError("bit: index out of range.");
  }
  return ((state.count >> b) & 1) as 0 | 1;
}

export interface TraceInput {
  readonly bits: number;
  readonly nTicks: number;
  readonly initial?: number;
  readonly direction?: "up" | "down";
}

export interface TraceFrame {
  readonly tick: number;
  readonly count: number;
  readonly bits: (0 | 1)[];
  readonly carry: boolean;
}

/** Run the counter for nTicks and return per-tick state + carry flags. */
export function trace(input: TraceInput): TraceFrame[] {
  if (!Number.isInteger(input.nTicks) || input.nTicks < 0) {
    throw new RangeError("trace: nTicks must be a non-negative integer.");
  }
  let state = makeCounter(input.bits, input.initial ?? 0);
  const out: TraceFrame[] = new Array(input.nTicks + 1);
  out[0] = {
    tick: 0,
    count: state.count,
    bits: bitsArray(state),
    carry: false,
  };
  for (let i = 1; i <= input.nTicks; i += 1) {
    const r = input.direction === "down" ? tickDown(state) : tick(state);
    state = r.state;
    out[i] = { tick: i, count: state.count, bits: bitsArray(state), carry: r.carry };
  }
  return out;
}

function bitsArray(state: CounterState): (0 | 1)[] {
  const out = new Array<0 | 1>(state.bits);
  for (let b = 0; b < state.bits; b += 1) out[b] = bit(state, b);
  return out;
}
