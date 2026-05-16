import { describe, expect, it } from "vitest";
import { type Plan, isSafe, planSequence, stateAt } from "../algorithm";

const normalPlan: Plan = {
  mode: "normal",
  timings: { greenMs: 5000, yellowMs: 2000, allRedMs: 500 },
};

describe("planSequence — input validation", () => {
  it("rejects totalMs ≤ 0", () => {
    expect(() => planSequence(normalPlan, 0)).toThrow(RangeError);
    expect(() => planSequence(normalPlan, -1)).toThrow(RangeError);
  });

  it("rejects non-positive green or yellow", () => {
    expect(() =>
      planSequence(
        { mode: "normal", timings: { greenMs: 0, yellowMs: 2000, allRedMs: 0 } },
        1000,
      ),
    ).toThrow(RangeError);
    expect(() =>
      planSequence(
        { mode: "normal", timings: { greenMs: 5000, yellowMs: 0, allRedMs: 0 } },
        1000,
      ),
    ).toThrow(RangeError);
  });

  it("rejects negative allRed", () => {
    expect(() =>
      planSequence(
        { mode: "normal", timings: { greenMs: 5000, yellowMs: 2000, allRedMs: -1 } },
        1000,
      ),
    ).toThrow(RangeError);
  });

  it("rejects non-positive pedHoldMs in ped mode", () => {
    expect(() =>
      planSequence(
        {
          mode: "ped",
          timings: { greenMs: 5000, yellowMs: 2000, allRedMs: 500 },
          pedHoldMs: 0,
        },
        5000,
      ),
    ).toThrow(RangeError);
  });
});

describe("normal mode", () => {
  it("first phase is NS green / EW red", () => {
    const seq = planSequence(normalPlan, 30000);
    expect(seq[0]!.ns).toBe("GREEN");
    expect(seq[0]!.ew).toBe("RED");
  });

  it("second phase is NS yellow / EW red", () => {
    const seq = planSequence(normalPlan, 30000);
    expect(seq[1]!.ns).toBe("YELLOW");
    expect(seq[1]!.ew).toBe("RED");
  });

  it("third phase is all RED (interlock)", () => {
    const seq = planSequence(normalPlan, 30000);
    expect(seq[2]!.ns).toBe("RED");
    expect(seq[2]!.ew).toBe("RED");
  });

  it("phase durations sum to totalMs", () => {
    const seq = planSequence(normalPlan, 30000);
    const sum = seq.reduce((acc, p) => acc + p.remainingMs, 0);
    expect(sum).toBe(30000);
  });

  it("never both GREEN simultaneously (safety invariant)", () => {
    const seq = planSequence(normalPlan, 60000);
    expect(isSafe(seq)).toBe(true);
  });

  it("after NS green/yellow/red, EW gets green", () => {
    const seq = planSequence(normalPlan, 30000);
    expect(seq[3]!.ns).toBe("RED");
    expect(seq[3]!.ew).toBe("GREEN");
  });
});

describe("ped mode", () => {
  it("locks both directions RED for pedHoldMs", () => {
    const plan: Plan = {
      mode: "ped",
      timings: { greenMs: 5000, yellowMs: 2000, allRedMs: 500 },
      pedHoldMs: 8000,
    };
    const seq = planSequence(plan, 10000);
    expect(seq.length).toBe(1);
    expect(seq[0]!.ns).toBe("RED");
    expect(seq[0]!.ew).toBe("RED");
    expect(seq[0]!.remainingMs).toBe(8000);
  });

  it("caps ped hold at totalMs", () => {
    const plan: Plan = {
      mode: "ped",
      timings: { greenMs: 5000, yellowMs: 2000, allRedMs: 500 },
      pedHoldMs: 20000,
    };
    const seq = planSequence(plan, 3000);
    expect(seq[0]!.remainingMs).toBe(3000);
  });
});

describe("flash mode", () => {
  it("alternates red/off at half-period cadence", () => {
    const plan: Plan = {
      mode: "flash",
      timings: { greenMs: 5000, yellowMs: 2000, allRedMs: 500 },
      flashHalfPeriodMs: 500,
    };
    const seq = planSequence(plan, 2000);
    expect(seq.length).toBe(4);
    expect(seq[0]!.ns).toBe("RED");
    expect(seq[0]!.ew).toBe("RED");
    // off phase modeled as YELLOW per algorithm doc
    expect(seq[1]!.ns).toBe("YELLOW");
    expect(seq[1]!.ew).toBe("YELLOW");
  });

  it("never both GREEN (safety)", () => {
    const plan: Plan = {
      mode: "flash",
      timings: { greenMs: 5000, yellowMs: 2000, allRedMs: 500 },
      flashHalfPeriodMs: 500,
    };
    expect(isSafe(planSequence(plan, 5000))).toBe(true);
  });
});

describe("stateAt", () => {
  it("returns NS green at t=0 in normal mode", () => {
    const s = stateAt(normalPlan, 30000, 0);
    expect(s.ns).toBe("GREEN");
    expect(s.ew).toBe("RED");
  });

  it("returns NS yellow inside that window", () => {
    // 0-5000: NS green; 5000-7000: NS yellow
    const s = stateAt(normalPlan, 30000, 6000);
    expect(s.ns).toBe("YELLOW");
  });

  it("returns all-RED during interlock", () => {
    // 7000-7500: all red
    const s = stateAt(normalPlan, 30000, 7200);
    expect(s.ns).toBe("RED");
    expect(s.ew).toBe("RED");
  });

  it("returns EW green after NS sequence", () => {
    // 7500-12500: EW green
    const s = stateAt(normalPlan, 30000, 8000);
    expect(s.ns).toBe("RED");
    expect(s.ew).toBe("GREEN");
  });

  it("rejects tMs out of [0, totalMs)", () => {
    expect(() => stateAt(normalPlan, 30000, -1)).toThrow(RangeError);
    expect(() => stateAt(normalPlan, 30000, 30000)).toThrow(RangeError);
  });
});
