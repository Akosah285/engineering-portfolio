// Traffic-light FSM — AIO_MQTT traffic-control project.
// Reference: Valvano, "Embedded Systems: Introduction to ARM Cortex M
// Microcontrollers", §6 (FSM design).
//
// Single intersection with North-South (NS) and East-West (EW) approaches.
// Each approach has GREEN, YELLOW, RED. Modes:
//   - "normal":   alternates with green/yellow/all-red phases
//   - "flash":    both directions flash RED at fixed cadence (warning mode)
//   - "ped":      pedestrian phase — both directions RED for `pedHoldMs`

export type Light = "GREEN" | "YELLOW" | "RED";
export type Mode = "normal" | "flash" | "ped";

export interface Phase {
  ns: Light;
  ew: Light;
  /** ms remaining in this phase. */
  remainingMs: number;
}

export interface NormalTimings {
  greenMs: number;
  yellowMs: number;
  allRedMs: number;
}

export interface Plan {
  mode: Mode;
  timings: NormalTimings;
  pedHoldMs?: number;
  flashHalfPeriodMs?: number;
}

function validateTimings(t: NormalTimings): void {
  if (t.greenMs <= 0 || t.yellowMs <= 0 || t.allRedMs < 0) {
    throw new RangeError("timings: greenMs and yellowMs must be > 0; allRedMs ≥ 0");
  }
}

// Plan a phase sequence for `totalMs` of simulated time.
export function planSequence(plan: Plan, totalMs: number): Phase[] {
  if (totalMs <= 0) {
    throw new RangeError("planSequence: totalMs must be > 0");
  }
  validateTimings(plan.timings);

  const phases: Phase[] = [];
  let elapsed = 0;

  if (plan.mode === "flash") {
    const half = plan.flashHalfPeriodMs ?? 500;
    if (half <= 0) throw new RangeError("flashHalfPeriodMs must be > 0");
    let on = true;
    while (elapsed < totalMs) {
      const dur = Math.min(half, totalMs - elapsed);
      phases.push({
        ns: on ? "RED" : "YELLOW",
        ew: on ? "RED" : "YELLOW",
        remainingMs: dur,
      });
      elapsed += dur;
      on = !on;
    }
    return phases;
  }

  if (plan.mode === "ped") {
    const hold = plan.pedHoldMs ?? 10000;
    if (hold <= 0) throw new RangeError("pedHoldMs must be > 0");
    phases.push({ ns: "RED", ew: "RED", remainingMs: Math.min(hold, totalMs) });
    return phases;
  }

  // normal cycle: NS green -> NS yellow -> all red -> EW green -> EW yellow -> all red
  const { greenMs, yellowMs, allRedMs } = plan.timings;
  const cycle: Phase[] = [
    { ns: "GREEN", ew: "RED", remainingMs: greenMs },
    { ns: "YELLOW", ew: "RED", remainingMs: yellowMs },
    { ns: "RED", ew: "RED", remainingMs: allRedMs },
    { ns: "RED", ew: "GREEN", remainingMs: greenMs },
    { ns: "RED", ew: "YELLOW", remainingMs: yellowMs },
    { ns: "RED", ew: "RED", remainingMs: allRedMs },
  ];
  let i = 0;
  while (elapsed < totalMs) {
    const p = cycle[i % cycle.length]!;
    const dur = Math.min(p.remainingMs, totalMs - elapsed);
    if (dur > 0) {
      phases.push({ ns: p.ns, ew: p.ew, remainingMs: dur });
      elapsed += dur;
    }
    i++;
  }
  return phases;
}

// Return the (ns, ew) state at absolute time `tMs` according to the plan.
export function stateAt(plan: Plan, totalMs: number, tMs: number): Phase {
  if (tMs < 0 || tMs >= totalMs) {
    throw new RangeError("stateAt: tMs out of [0, totalMs)");
  }
  const seq = planSequence(plan, totalMs);
  let acc = 0;
  for (const p of seq) {
    if (tMs < acc + p.remainingMs) {
      return { ns: p.ns, ew: p.ew, remainingMs: acc + p.remainingMs - tMs };
    }
    acc += p.remainingMs;
  }
  // shouldn't reach here if totalMs covered
  const last = seq[seq.length - 1]!;
  return { ns: last.ns, ew: last.ew, remainingMs: 0 };
}

// Invariant check: at no time may both NS and EW be GREEN.
export function isSafe(seq: readonly Phase[]): boolean {
  for (const p of seq) {
    if (p.ns === "GREEN" && p.ew === "GREEN") return false;
  }
  return true;
}
