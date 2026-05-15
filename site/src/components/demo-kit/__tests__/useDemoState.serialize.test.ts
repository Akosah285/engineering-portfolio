import { describe, expect, it } from "vitest";
import { serializeState } from "../useDemoState";

describe("serializeState — URL fragment serialization", () => {
  it("serializes a single number into the fragment", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
    };
    const fragment = serializeState({ sigma: 28 }, schema, "lorenz");
    expect(fragment).toBe("#demo=lorenz&sigma=28");
  });

  it("serializes multiple fields in schema-key order", () => {
    const schema = {
      sigma: { type: "number" as const, default: 10 },
      beta: { type: "number" as const, default: 2.667 },
      rho: { type: "number" as const, default: 28 },
    };
    const fragment = serializeState(
      { sigma: 10, beta: 2.667, rho: 28 },
      schema,
      "lorenz",
    );
    expect(fragment).toBe("#demo=lorenz&sigma=10&beta=2.667&rho=28");
  });

  it("URL-encodes string values containing special chars", () => {
    const schema = {
      label: { type: "string" as const, default: "hello" },
    };
    const fragment = serializeState(
      { label: "hello world & co" },
      schema,
      "demo-x",
    );
    expect(fragment).toBe("#demo=demo-x&label=hello+world+%26+co");
  });

  it("serializes enum values as their string form", () => {
    const schema = {
      mode: {
        type: "enum" as const,
        default: "ridge",
        values: ["none", "ridge", "lasso"] as const,
      },
    };
    const fragment = serializeState({ mode: "lasso" }, schema, "polyreg");
    expect(fragment).toBe("#demo=polyreg&mode=lasso");
  });

  it("preserves negative numbers and decimals", () => {
    const schema = {
      x: { type: "number" as const, default: 0 },
      y: { type: "number" as const, default: 0 },
    };
    const fragment = serializeState({ x: -1.5, y: 0.001 }, schema, "grad");
    expect(fragment).toBe("#demo=grad&x=-1.5&y=0.001");
  });
});

