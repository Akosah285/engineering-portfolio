// State machine for the v8 Mechatronics "decision_making.ino" lab.
//
// Robot has 4 high-level behaviors selected by sensor input + lab state:
//   - SEARCHING       (wandering / scanning)
//   - WALL_FOLLOWING  (left-hand rule, hugging wall)
//   - TURNING         (right-angle turn)
//   - DONE            (finished maze)
//
// Inputs (subset of decision_making.ino's sensor packets):
//   "wall_detected_front" — front sonar trip
//   "wall_detected_left"  — left sonar trip
//   "wall_lost_left"      — left sonar dropout
//   "intersection"        — both side sensors trip
//   "goal_reached"        — RFID/marker beacon
//   "tick"                — periodic clock
//
// This is the canonical generic-FSM wrapper, but it ships with the lab's
// actual transition table baked in so the demo presets just work.

export type DMState = "SEARCHING" | "WALL_FOLLOWING" | "TURNING" | "DONE";
export type DMInput =
  | "wall_detected_front"
  | "wall_detected_left"
  | "wall_lost_left"
  | "intersection"
  | "goal_reached"
  | "tick";

export function transition(state: DMState, input: DMInput): DMState {
  if (input === "goal_reached") return "DONE";
  if (state === "DONE") return "DONE";
  if (state === "SEARCHING") {
    if (input === "wall_detected_left") return "WALL_FOLLOWING";
    if (input === "wall_detected_front") return "TURNING";
    return "SEARCHING";
  }
  if (state === "WALL_FOLLOWING") {
    if (input === "wall_lost_left") return "TURNING";
    if (input === "wall_detected_front") return "TURNING";
    return "WALL_FOLLOWING";
  }
  if (state === "TURNING") {
    if (input === "tick") return "WALL_FOLLOWING";
    if (input === "intersection") return "SEARCHING";
    return "TURNING";
  }
  return state;
}

export interface RunResult {
  readonly states: readonly DMState[]; // includes initial state
  readonly finalState: DMState;
}

export function run(initial: DMState, inputs: readonly DMInput[]): RunResult {
  const valid: readonly DMState[] = ["SEARCHING", "WALL_FOLLOWING", "TURNING", "DONE"];
  if (!valid.includes(initial)) {
    throw new RangeError(`invalid initial state: ${initial}`);
  }
  const trace: DMState[] = [initial];
  let cur = initial;
  for (const input of inputs) {
    cur = transition(cur, input);
    trace.push(cur);
  }
  return { states: trace, finalState: cur };
}

// Behaviour assertion: in DONE, robot ignores all subsequent inputs (sticky).
export function isTerminal(state: DMState): boolean {
  return state === "DONE";
}
