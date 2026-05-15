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
});
