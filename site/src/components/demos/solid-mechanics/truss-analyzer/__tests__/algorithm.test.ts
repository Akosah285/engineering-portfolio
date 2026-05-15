import { describe, expect, it } from "vitest";

import { analyze, type Joint, type Member } from "../algorithm";

describe("analyze — statically determinate trusses", () => {
  it("simple 3-bar triangle with vertical load at apex", () => {
    // Joints: A=(0,0) pin, B=(4,0) roller-y, C=(2, 3.464) apex
    // Member AC: 60°, BC: 120°.  Load at C: Fx=0, Fy=-1000 (downward).
    const joints: Joint[] = [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 4, y: 0 },
      { id: "C", x: 2, y: 2 * Math.sqrt(3) },
    ];
    const members: Member[] = [
      { i: "A", j: "B" },
      { i: "A", j: "C" },
      { i: "B", j: "C" },
    ];
    const r = analyze({
      joints,
      members,
      loads: [{ joint: "C", Fx: 0, Fy: -1000 }],
      supports: [
        { joint: "A", kind: "pin" },
        { joint: "B", kind: "roller-y" },
      ],
    });
    expect(r.solvable).toBe(true);
    // By symmetry: AC and BC carry equal compression of 1000 / (2*sin60) = 577 each
    const FAC = r.memberForces.find((m) => m.member.i === "A" && m.member.j === "C")!.force;
    const FBC = r.memberForces.find((m) => m.member.i === "B" && m.member.j === "C")!.force;
    expect(Math.abs(FAC + 577.35)).toBeLessThan(0.5); // negative ⇒ compression
    expect(Math.abs(FBC + 577.35)).toBeLessThan(0.5);
    // Bottom chord AB carries equal tension by horizontal equilibrium at A: 577 cos60 = 288.7
    const FAB = r.memberForces.find((m) => m.member.i === "A" && m.member.j === "B")!.force;
    expect(Math.abs(FAB - 288.68)).toBeLessThan(0.5);
  });

  it("vertical reactions sum to the applied vertical load", () => {
    const r = analyze({
      joints: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 4, y: 0 },
        { id: "C", x: 2, y: 2 * Math.sqrt(3) },
      ],
      members: [
        { i: "A", j: "B" },
        { i: "A", j: "C" },
        { i: "B", j: "C" },
      ],
      loads: [{ joint: "C", Fx: 0, Fy: -1000 }],
      supports: [
        { joint: "A", kind: "pin" },
        { joint: "B", kind: "roller-y" },
      ],
    });
    const RyA = r.reactions.find((x) => x.joint === "A")!.Ry;
    const RyB = r.reactions.find((x) => x.joint === "B")!.Ry;
    expect(RyA + RyB).toBeCloseTo(1000, 6);
    // By symmetry with the load at the centroid in x, RyA = RyB = 500.
    expect(RyA).toBeCloseTo(500, 6);
    expect(RyB).toBeCloseTo(500, 6);
  });
});

describe("analyze — determinacy + error handling", () => {
  it("flags an indeterminate truss as not solvable", () => {
    // 4 joints, 5 members + 4 reactions ⇒ 2J=8, U=9; statically indeterminate.
    const r = analyze({
      joints: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 1, y: 0 },
        { id: "C", x: 1, y: 1 },
        { id: "D", x: 0, y: 1 },
      ],
      members: [
        { i: "A", j: "B" },
        { i: "B", j: "C" },
        { i: "C", j: "D" },
        { i: "D", j: "A" },
        { i: "A", j: "C" },
      ],
      loads: [],
      supports: [
        { joint: "A", kind: "pin" },
        { joint: "B", kind: "pin" },
      ],
    });
    expect(r.solvable).toBe(false);
  });

  it("RangeError on missing joints/members or unknown member endpoint", () => {
    expect(() => analyze({ joints: [], members: [], loads: [], supports: [] })).toThrow(RangeError);
    expect(() =>
      analyze({
        joints: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 1, y: 0 }],
        members: [{ i: "A", j: "X" }],
        loads: [],
        supports: [{ joint: "A", kind: "pin" }, { joint: "B", kind: "roller-y" }],
      }),
    ).toThrow(RangeError);
  });

  it("RangeError on zero-length member (when system is otherwise determinate)", () => {
    // 2 joints with the same coordinates, 1 member, 1 pin + 1 roller-y ⇒ U = 3, 2J = 4.
    // Add a second member to a phantom third joint... easier: just verify the analyzer
    // throws on a zero-length member by setting up a system that DOES pass determinacy.
    // J=2, M=2 (one zero-length, one normal), pin at A, roller-y at B ⇒ U = 5, 2J = 4.
    // To make 2J=U, use 2 joints, 1 member, 1 pin, 1 roller-y ⇒ U=3 ≠ 4 ⇒ early exit.
    // Direct test: reach the check by using 3 joints + 3 members + 3 reactions ⇒ U=6, 2J=6.
    expect(() =>
      analyze({
        joints: [
          { id: "A", x: 0, y: 0 },
          { id: "B", x: 0, y: 0 },
          { id: "C", x: 1, y: 0 },
        ],
        members: [
          { i: "A", j: "B" }, // zero length
          { i: "B", j: "C" },
          { i: "A", j: "C" },
        ],
        loads: [],
        supports: [
          { joint: "A", kind: "pin" },
          { joint: "C", kind: "roller-y" },
        ],
      }),
    ).toThrow(RangeError);
  });
});

describe("analyze — sign convention", () => {
  it("a horizontal member carrying a pulling joint load comes out as positive (tension)", () => {
    // A pin at (0,0); B roller-x at (1,0); load Fx=+100 at B (pulling right).
    // Member AB must resist as tension ⇒ +100 axial.
    const r = analyze({
      joints: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 1, y: 0 },
      ],
      members: [{ i: "A", j: "B" }],
      loads: [{ joint: "B", Fx: 100, Fy: 0 }],
      supports: [
        { joint: "A", kind: "pin" },
        { joint: "B", kind: "roller-y" },
      ],
    });
    // J=2, M=1, R=3 ⇒ U=4 = 2J ✓
    expect(r.solvable).toBe(true);
    const FAB = r.memberForces[0]!.force;
    expect(FAB).toBeCloseTo(100, 6);
  });
});
