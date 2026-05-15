import { describe, expect, it } from "vitest";
import { deserializeState, serializeState } from "../useDemoState";

describe("deserializeState — URL fragment parsing", () => {
  it("parses a single number from the fragment", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
    };
    const state = deserializeState("#demo=lorenz&sigma=28", schema);
    expect(state).toEqual({ sigma: 28 });
  });

  it("falls back to defaults when the fragment is empty", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
      beta: { type: "number" as const, default: 2.667 },
    };
    const state = deserializeState("", schema);
    expect(state).toEqual({ sigma: 10, beta: 2.667 });
  });

  it("falls back to defaults for missing keys", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
      beta: { type: "number" as const, default: 2.667 },
      rho: { type: "number" as const, default: 28 },
    };
    const state = deserializeState("#demo=lorenz&sigma=15", schema);
    expect(state).toEqual({ sigma: 15, beta: 2.667, rho: 28 });
  });

  it("ignores unknown keys not in the schema", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
    };
    const state = deserializeState(
      "#demo=lorenz&sigma=20&unknown=foo&another=42",
      schema,
    );
    expect(state).toEqual({ sigma: 20 });
  });

  it("falls back to default when number value cannot be parsed", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
    };
    const state = deserializeState("#demo=lorenz&sigma=not-a-number", schema);
    expect(state).toEqual({ sigma: 10 });
  });

  it("URL-decodes string values", () => {
    const schema = {
      label: { type: "string" as const, default: "hello" },
    };
    const state = deserializeState("#demo=demo-x&label=hello+world+%26+co", schema);
    expect(state).toEqual({ label: "hello world & co" });
  });

  it("falls back to default when enum value is not in allowed values", () => {
    const schema = {
      mode: {
        type: "enum" as const,
        default: "ridge",
        values: ["none", "ridge", "lasso"] as const,
      },
    };
    const state = deserializeState("#demo=polyreg&mode=elastic-net", schema);
    expect(state).toEqual({ mode: "ridge" });
  });

  it("accepts valid enum value", () => {
    const schema = {
      mode: {
        type: "enum" as const,
        default: "ridge",
        values: ["none", "ridge", "lasso"] as const,
      },
    };
    const state = deserializeState("#demo=polyreg&mode=lasso", schema);
    expect(state).toEqual({ mode: "lasso" });
  });

  it("handles fragment with no leading hash", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
    };
    const state = deserializeState("demo=lorenz&sigma=42", schema);
    expect(state).toEqual({ sigma: 42 });
  });

  it("preserves negative numbers and decimals", () => {
    const schema = {
      x: { type: "number" as const, default: 0 },
      y: { type: "number" as const, default: 0 },
    };
    const state = deserializeState("#demo=grad&x=-1.5&y=0.001", schema);
    expect(state).toEqual({ x: -1.5, y: 0.001 });
  });
});

describe("serialize ↔ deserialize round-trip", () => {
  it("round-trips a mixed-type state", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
      label: { type: "string" as const, default: "hello" },
      mode: {
        type: "enum" as const,
        default: "ridge",
        values: ["none", "ridge", "lasso"] as const,
      },
    };
    const original = { sigma: 28, label: "the trajectory", mode: "lasso" };
    const fragment = serializeState(original, schema, "demo-y");
    const restored = deserializeState(fragment, schema);
    expect(restored).toEqual(original);
  });

  it("round-trips at default values (no info loss)", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
    };
    const original = { sigma: 10 };
    const fragment = serializeState(original, schema, "lorenz");
    const restored = deserializeState(fragment, schema);
    expect(restored).toEqual(original);
  });
});
