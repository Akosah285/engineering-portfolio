import { describe, expect, it } from "vitest";

import {
  forwardKinematics,
  inverseKinematics,
  workspaceInnerRadius,
  workspaceOuterRadius,
} from "../algorithm";

describe("forwardKinematics", () => {
  it("at θ1=0, θ2=0 the arm is fully stretched along +x", () => {
    const p = forwardKinematics({ l1: 1, l2: 1, theta1: 0, theta2: 0 });
    expect(p.x).toBeCloseTo(2, 12);
    expect(p.y).toBeCloseTo(0, 12);
    expect(p.elbow.x).toBeCloseTo(1, 12);
    expect(p.elbow.y).toBeCloseTo(0, 12);
  });

  it("at θ1=π/2, θ2=0 the arm is fully stretched along +y", () => {
    const p = forwardKinematics({ l1: 1, l2: 1, theta1: Math.PI / 2, theta2: 0 });
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(2, 12);
  });

  it("at θ1=0, θ2=π the arm folds back to the origin", () => {
    const p = forwardKinematics({ l1: 1, l2: 1, theta1: 0, theta2: Math.PI });
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(0, 12);
  });

  it("RangeError on non-positive link length", () => {
    expect(() => forwardKinematics({ l1: 0, l2: 1, theta1: 0, theta2: 0 })).toThrow(
      RangeError,
    );
    expect(() => forwardKinematics({ l1: 1, l2: -1, theta1: 0, theta2: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("inverseKinematics — round-trip with FK", () => {
  it("FK(IK(x,y)) returns to (x,y) for a generic reachable point", () => {
    const target = { x: 1.2, y: 0.7 };
    const ik = inverseKinematics({ ...target, l1: 1, l2: 1 });
    expect(ik.reachable).toBe(true);
    expect(ik.poses.length).toBe(2);
    for (const pose of ik.poses) {
      const p = forwardKinematics({ ...pose, l1: 1, l2: 1 });
      expect(p.x).toBeCloseTo(target.x, 12);
      expect(p.y).toBeCloseTo(target.y, 12);
    }
  });

  it("respects elbow preference when provided", () => {
    const ikUp = inverseKinematics({ x: 1, y: 0.5, l1: 1, l2: 1, elbow: "up" });
    const ikDn = inverseKinematics({ x: 1, y: 0.5, l1: 1, l2: 1, elbow: "down" });
    expect(ikUp.poses.length).toBe(1);
    expect(ikDn.poses.length).toBe(1);
    // elbow up has theta2 > 0, elbow down has theta2 < 0 (this geometry)
    expect(ikUp.poses[0]!.theta2).toBeGreaterThan(0);
    expect(ikDn.poses[0]!.theta2).toBeLessThan(0);
  });
});

describe("inverseKinematics — workspace boundaries", () => {
  it("flags points beyond outer radius as unreachable", () => {
    const r = inverseKinematics({ x: 3, y: 0, l1: 1, l2: 1 });
    expect(r.reachable).toBe(false);
    expect(r.poses.length).toBe(0);
  });

  it("flags points inside the inner forbidden disc as unreachable (uneven links)", () => {
    // |l1 - l2| = 1; (0.3, 0) is inside the forbidden disc.
    const r = inverseKinematics({ x: 0.3, y: 0, l1: 2, l2: 1 });
    expect(r.reachable).toBe(false);
  });

  it("flags singular at the outer boundary (theta2 = 0)", () => {
    const r = inverseKinematics({ x: 2, y: 0, l1: 1, l2: 1 });
    expect(r.reachable).toBe(true);
    expect(r.singular).toBe(true);
    expect(r.poses.length).toBe(1);
    expect(r.poses[0]!.theta2).toBeCloseTo(0, 6);
  });

  it("flags singular at the inner boundary (theta2 = π for equal links: origin)", () => {
    const r = inverseKinematics({ x: 0, y: 0, l1: 1, l2: 1 });
    expect(r.reachable).toBe(true);
    expect(r.singular).toBe(true);
    expect(r.poses.length).toBe(1);
    expect(Math.abs(r.poses[0]!.theta2)).toBeCloseTo(Math.PI, 6);
  });
});

describe("workspace helpers", () => {
  it("outer radius is l1 + l2", () => {
    expect(workspaceOuterRadius(1, 2)).toBe(3);
  });

  it("inner radius is |l1 - l2|", () => {
    expect(workspaceInnerRadius(1, 2)).toBe(1);
    expect(workspaceInnerRadius(3, 1)).toBe(2);
    expect(workspaceInnerRadius(2, 2)).toBe(0);
  });
});

describe("inverseKinematics — error gates", () => {
  it("RangeError on non-positive link length", () => {
    expect(() => inverseKinematics({ x: 1, y: 0, l1: 0, l2: 1 })).toThrow(RangeError);
    expect(() => inverseKinematics({ x: 1, y: 0, l1: 1, l2: -1 })).toThrow(RangeError);
  });
});
