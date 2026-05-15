import { describe, expect, it } from "vitest";
import {
  MAX_TAGS_PER_COURSE,
  TagValidationError,
  buildTagValidator,
  isKebabCase,
} from "../validator";

const VOCAB = ["monte-carlo", "rk4-integration", "fourier-series"];

describe("buildTagValidator", () => {
  it("accepts a list of all-known tags", () => {
    const v = buildTagValidator(VOCAB);
    expect(v.validate(["monte-carlo", "rk4-integration"])).toEqual([
      "monte-carlo",
      "rk4-integration",
    ]);
  });

  it("rejects an unknown tag with a helpful error", () => {
    const v = buildTagValidator(VOCAB);
    expect(() => v.validate(["not-in-vocab"])).toThrow(TagValidationError);
    try {
      v.validate(["not-in-vocab"]);
    } catch (e) {
      expect(String(e)).toMatch(/not-in-vocab/);
    }
  });

  it("lists ALL unknown tags in the error, not just the first", () => {
    const v = buildTagValidator(VOCAB);
    try {
      v.validate(["not-real", "monte-carlo", "also-fake"]);
      throw new Error("should have thrown");
    } catch (e) {
      const msg = String(e);
      expect(msg).toMatch(/not-real/);
      expect(msg).toMatch(/also-fake/);
    }
  });

  it("rejects more than MAX_TAGS_PER_COURSE tags", () => {
    expect(MAX_TAGS_PER_COURSE).toBe(5);
    const v = buildTagValidator([
      "monte-carlo",
      "rk4-integration",
      "fourier-series",
      "newton-raphson",
      "bayes-theorem",
      "pid-control",
    ]);
    expect(() =>
      v.validate([
        "monte-carlo",
        "rk4-integration",
        "fourier-series",
        "newton-raphson",
        "bayes-theorem",
        "pid-control",
      ]),
    ).toThrow(/at most 5/i);
  });

  it("accepts exactly MAX_TAGS_PER_COURSE tags", () => {
    const v = buildTagValidator([
      "monte-carlo",
      "rk4-integration",
      "fourier-series",
      "newton-raphson",
      "bayes-theorem",
    ]);
    const result = v.validate([
      "monte-carlo",
      "rk4-integration",
      "fourier-series",
      "newton-raphson",
      "bayes-theorem",
    ]);
    expect(result).toHaveLength(5);
  });

  it("dedupes accidental repeats", () => {
    const v = buildTagValidator(VOCAB);
    expect(v.validate(["monte-carlo", "monte-carlo"])).toEqual(["monte-carlo"]);
  });

  it("accepts empty tag list", () => {
    const v = buildTagValidator(VOCAB);
    expect(v.validate([])).toEqual([]);
  });

  it("rejects non-kebab-case vocabulary at construction time", () => {
    expect(() => buildTagValidator(["UPPERCASE"])).toThrow(/kebab-case/i);
    expect(() => buildTagValidator(["with_underscore"])).toThrow(/kebab-case/i);
    expect(() => buildTagValidator(["with space"])).toThrow(/kebab-case/i);
  });

  it("rejects duplicate tags in vocabulary at construction time", () => {
    expect(() => buildTagValidator(["monte-carlo", "monte-carlo"])).toThrow(/duplicate/i);
  });

  it("knownTags() returns the vocabulary alphabetically sorted", () => {
    const v = buildTagValidator(["zeta", "alpha", "beta"]);
    expect(v.knownTags()).toEqual(["alpha", "beta", "zeta"]);
  });

  it("isKnown(tag) returns whether tag is in vocabulary", () => {
    const v = buildTagValidator(VOCAB);
    expect(v.isKnown("monte-carlo")).toBe(true);
    expect(v.isKnown("not-real")).toBe(false);
  });
});

describe("isKebabCase", () => {
  it.each(["monte-carlo", "rk4-integration", "x", "ab-cd", "ab123-cd"])(
    "accepts %s",
    (s) => {
      expect(isKebabCase(s)).toBe(true);
    },
  );

  it.each([
    "Monte-Carlo",
    "monte_carlo",
    "monte carlo",
    "monte--carlo",
    "-leading",
    "trailing-",
    "",
    "with.dot",
  ])("rejects %s", (s) => {
    expect(isKebabCase(s)).toBe(false);
  });
});
