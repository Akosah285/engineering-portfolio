/**
 * Tests for the course frontmatter validator.
 *
 * The validator is the structural bridge between author-written MDX
 * frontmatter and the typed `CourseFrontmatter` consumed by the
 * `<CoursePage>` layout. Wired into Astro's Content Collection schema
 * in `content/config.ts`.
 */

import { describe, expect, it } from "vitest";
import { buildTagValidator } from "../concepts/validator";
import {
  type CourseFrontmatter,
  CourseFrontmatterError,
  buildFrontmatterValidator,
} from "../courseFrontmatter";

const VOCAB = ["gradient-descent", "linear-regression", "monte-carlo"];

function mkValidator() {
  return buildFrontmatterValidator(buildTagValidator(VOCAB));
}

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Machine Learning & Statistical Data Analysis",
    term: "SP20",
    oneLineTakeaway: "How to build models that generalise.",
    concepts: ["gradient-descent", "linear-regression"],
    publishedAt: "2024-01-15",
    draft: false,
    ...overrides,
  };
}

describe("buildFrontmatterValidator — happy path", () => {
  it("returns a typed CourseFrontmatter when input is valid", () => {
    const v = mkValidator();
    const out = v.validate(valid());
    expect(out.title).toBe("Machine Learning & Statistical Data Analysis");
    expect(out.term).toBe("SP20");
    expect(out.oneLineTakeaway).toBe("How to build models that generalise.");
    expect(out.concepts).toEqual(["gradient-descent", "linear-regression"]);
    expect(out.publishedAt).toBe("2024-01-15");
    expect(out.draft).toBe(false);
  });

  it("accepts publishedAt=null for unpublished courses", () => {
    const v = mkValidator();
    const out = v.validate(valid({ publishedAt: null }));
    expect(out.publishedAt).toBeNull();
  });

  it("accepts heroDemoLabel as optional", () => {
    const v = mkValidator();
    const out = v.validate(valid({ heroDemoLabel: "Gradient Descent Visualizer" }));
    expect(out.heroDemoLabel).toBe("Gradient Descent Visualizer");
  });

  it("omits heroDemoLabel when missing", () => {
    const v = mkValidator();
    const out = v.validate(valid());
    expect(out.heroDemoLabel).toBeUndefined();
  });

  it("defaults draft to false when missing", () => {
    const v = mkValidator();
    const { draft: _omit, ...rest } = valid();
    void _omit;
    const out = v.validate(rest);
    expect(out.draft).toBe(false);
  });

  it("preserves draft=true", () => {
    const v = mkValidator();
    const out = v.validate(valid({ draft: true }));
    expect(out.draft).toBe(true);
  });

  it("defaults interviewPending to false when missing", () => {
    const v = mkValidator();
    const out = v.validate(valid());
    expect(out.interviewPending).toBe(false);
  });

  it("preserves interviewPending=true", () => {
    const v = mkValidator();
    const out = v.validate(valid({ interviewPending: true }));
    expect(out.interviewPending).toBe(true);
  });

  it("preserves interviewPending=false when explicitly set", () => {
    const v = mkValidator();
    const out = v.validate(valid({ interviewPending: false }));
    expect(out.interviewPending).toBe(false);
  });

  it("rejects interviewPending of non-boolean type", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ interviewPending: "yes" }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("accepts an empty concepts list", () => {
    const v = mkValidator();
    const out = v.validate(valid({ concepts: [] }));
    expect(out.concepts).toEqual([]);
  });

  it("deduplicates the concepts list", () => {
    const v = mkValidator();
    const out = v.validate(valid({ concepts: ["gradient-descent", "gradient-descent"] }));
    expect(out.concepts).toEqual(["gradient-descent"]);
  });
});

describe("buildFrontmatterValidator — title rules", () => {
  it("rejects missing title", () => {
    const v = mkValidator();
    const { title: _omit, ...rest } = valid();
    void _omit;
    expect(() => v.validate(rest)).toThrow(CourseFrontmatterError);
  });

  it("rejects empty title", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ title: "" }))).toThrow(CourseFrontmatterError);
  });

  it("rejects whitespace-only title", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ title: "   " }))).toThrow(CourseFrontmatterError);
  });

  it("rejects non-string title", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ title: 42 }))).toThrow(CourseFrontmatterError);
  });
});

describe("buildFrontmatterValidator — term rules", () => {
  it("accepts term patterns SP20/FA19/WI21/SU20", () => {
    const v = mkValidator();
    for (const term of ["SP20", "FA19", "WI21", "SU20"]) {
      expect(() => v.validate(valid({ term }))).not.toThrow();
    }
  });

  it("rejects malformed term", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ term: "Spring 2020" }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("rejects missing term", () => {
    const v = mkValidator();
    const { term: _omit, ...rest } = valid();
    void _omit;
    expect(() => v.validate(rest)).toThrow(CourseFrontmatterError);
  });
});

describe("buildFrontmatterValidator — oneLineTakeaway rules", () => {
  it("rejects empty takeaway", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ oneLineTakeaway: "" }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("rejects missing takeaway", () => {
    const v = mkValidator();
    const { oneLineTakeaway: _omit, ...rest } = valid();
    void _omit;
    expect(() => v.validate(rest)).toThrow(CourseFrontmatterError);
  });

  it("rejects takeaway longer than 200 chars", () => {
    const v = mkValidator();
    const longString = "x".repeat(201);
    expect(() => v.validate(valid({ oneLineTakeaway: longString }))).toThrow(
      CourseFrontmatterError,
    );
  });
});

describe("buildFrontmatterValidator — concepts rules", () => {
  it("rejects unknown tags", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ concepts: ["totally-made-up-tag"] }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("rejects non-array concepts", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ concepts: "gradient-descent" }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("rejects more than 5 concepts", () => {
    const big = buildFrontmatterValidator(
      buildTagValidator(["a", "b", "c", "d", "e", "f"]),
    );
    expect(() =>
      big.validate(valid({ concepts: ["a", "b", "c", "d", "e", "f"] })),
    ).toThrow(CourseFrontmatterError);
  });

  it("includes the unknown tag in the error message", () => {
    const v = mkValidator();
    try {
      v.validate(valid({ concepts: ["nope-not-real"] }));
      throw new Error("expected throw");
    } catch (e) {
      expect((e as Error).message).toContain("nope-not-real");
    }
  });
});

describe("buildFrontmatterValidator — publishedAt rules", () => {
  it("rejects non-ISO-date strings", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ publishedAt: "Jan 15, 2024" }))).toThrow(
      CourseFrontmatterError,
    );
    expect(() => v.validate(valid({ publishedAt: "2024-1-1" }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("rejects impossible dates", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ publishedAt: "2024-13-45" }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("accepts publishedAt missing entirely (defaults to null)", () => {
    const v = mkValidator();
    const { publishedAt: _omit, ...rest } = valid();
    void _omit;
    const out = v.validate(rest);
    expect(out.publishedAt).toBeNull();
  });
});

describe("buildFrontmatterValidator — heroDemoLabel rules", () => {
  it("rejects non-string heroDemoLabel", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ heroDemoLabel: 42 }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("rejects empty heroDemoLabel (use omit instead)", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ heroDemoLabel: "" }))).toThrow(
      CourseFrontmatterError,
    );
  });
});

describe("buildFrontmatterValidator — techTags rules", () => {
  it("defaults techTags to [] when omitted", () => {
    const v = mkValidator();
    const out = v.validate(valid());
    expect(out.techTags).toEqual([]);
  });

  it("accepts an array of non-empty strings", () => {
    const v = mkValidator();
    const out = v.validate(valid({ techTags: ["Python", "NumPy", "scikit-learn"] }));
    expect(out.techTags).toEqual(["Python", "NumPy", "scikit-learn"]);
  });

  it("rejects non-array techTags", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ techTags: "Python" }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("rejects non-string entries", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ techTags: ["Python", 42] }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("rejects empty-string entries", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ techTags: ["Python", ""] }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("rejects whitespace-only entries", () => {
    const v = mkValidator();
    expect(() => v.validate(valid({ techTags: ["Python", "   "] }))).toThrow(
      CourseFrontmatterError,
    );
  });

  it("deduplicates while preserving order", () => {
    const v = mkValidator();
    const out = v.validate(
      valid({ techTags: ["Python", "NumPy", "Python", "scikit-learn"] }),
    );
    expect(out.techTags).toEqual(["Python", "NumPy", "scikit-learn"]);
  });

  it("rejects more than 8 techTags", () => {
    const v = mkValidator();
    const tooMany = Array.from({ length: 9 }, (_, i) => `T${i}`);
    expect(() => v.validate(valid({ techTags: tooMany }))).toThrow(
      CourseFrontmatterError,
    );
  });
});

describe("buildFrontmatterValidator — bulk shape", () => {
  it("rejects non-object input", () => {
    const v = mkValidator();
    expect(() => v.validate(null)).toThrow(CourseFrontmatterError);
    expect(() => v.validate("string")).toThrow(CourseFrontmatterError);
    expect(() => v.validate([])).toThrow(CourseFrontmatterError);
  });

  it("returned object is structurally typed as CourseFrontmatter", () => {
    const v = mkValidator();
    // Compile-time check: the .validate return is assignable.
    const out: CourseFrontmatter = v.validate(valid());
    expect(out).toBeDefined();
  });
});
