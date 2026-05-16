// Generic finite-state machine simulator (Moore + Mealy).
// Demo wraps this brain around the lab-3 Stopwatch FSM preset.
//
// FSM = { states, inputs, transitions: (state, input) → state, outputs?:
//   { kind: "moore", out: (state) → output } | { kind: "mealy", out: (state, input) → output } }
//
// Steps a sequence of inputs and returns trace + final state.

export interface MooreOutputs<S, O> {
  readonly kind: "moore";
  readonly out: (state: S) => O;
}

export interface MealyOutputs<S, I, O> {
  readonly kind: "mealy";
  readonly out: (state: S, input: I) => O;
}

export interface FSMSpec<S extends string, I extends string, O> {
  readonly states: readonly S[];
  readonly inputs: readonly I[];
  readonly initial: S;
  readonly transition: (state: S, input: I) => S;
  readonly outputs?: MooreOutputs<S, O> | MealyOutputs<S, I, O>;
}

export interface Step<S, I, O> {
  readonly from: S;
  readonly input: I;
  readonly to: S;
  readonly output: O | null;
}

export interface RunResult<S, I, O> {
  readonly trace: readonly Step<S, I, O>[];
  readonly finalState: S;
}

function validateSpec<S extends string, I extends string, O>(
  spec: FSMSpec<S, I, O>,
): void {
  if (spec.states.length === 0) throw new RangeError("FSM must have at least one state");
  if (!spec.states.includes(spec.initial)) {
    throw new RangeError(`initial state ${spec.initial} not in states`);
  }
  if (spec.inputs.length === 0) throw new RangeError("FSM must define at least one input");
}

export function run<S extends string, I extends string, O>(
  spec: FSMSpec<S, I, O>,
  inputs: readonly I[],
): RunResult<S, I, O> {
  validateSpec(spec);
  for (const inp of inputs) {
    if (!spec.inputs.includes(inp)) {
      throw new RangeError(`input ${inp} not in alphabet`);
    }
  }
  const trace: Step<S, I, O>[] = [];
  let state: S = spec.initial;
  for (const input of inputs) {
    const next = spec.transition(state, input);
    if (!spec.states.includes(next)) {
      throw new RangeError(`transition produced unknown state ${next}`);
    }
    let output: O | null = null;
    if (spec.outputs) {
      if (spec.outputs.kind === "moore") {
        output = spec.outputs.out(next);
      } else {
        output = spec.outputs.out(state, input);
      }
    }
    trace.push({ from: state, input, to: next, output });
    state = next;
  }
  return { trace, finalState: state };
}

// Stopwatch FSM preset (matches lab3 specification).
//   States: IDLE → RUNNING → PAUSED (→ RUNNING) → ... → reset → IDLE
//   Inputs: "start", "pause", "resume", "reset", "tick"
//
// Outputs (Moore): "stopped" | "ticking" | "paused"
export type StopwatchState = "IDLE" | "RUNNING" | "PAUSED";
export type StopwatchInput = "start" | "pause" | "resume" | "reset" | "tick";
export type StopwatchOutput = "stopped" | "ticking" | "paused";

export const stopwatchFSM: FSMSpec<StopwatchState, StopwatchInput, StopwatchOutput> = {
  states: ["IDLE", "RUNNING", "PAUSED"],
  inputs: ["start", "pause", "resume", "reset", "tick"],
  initial: "IDLE",
  transition: (state, input) => {
    if (input === "reset") return "IDLE";
    if (state === "IDLE" && input === "start") return "RUNNING";
    if (state === "RUNNING" && input === "pause") return "PAUSED";
    if (state === "PAUSED" && input === "resume") return "RUNNING";
    return state;
  },
  outputs: {
    kind: "moore",
    out: (state) => {
      if (state === "IDLE") return "stopped";
      if (state === "RUNNING") return "ticking";
      return "paused";
    },
  },
};
