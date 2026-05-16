/**
 * Course MDX frontmatter validator.
 *
 * Author-facing contract for every `src/content/courses/<slug>.mdx` file:
 *
 *   ---
 *   title: "Machine Learning & Statistical Data Analysis"
 *   term: "SP20"
 *   oneLineTakeaway: "How to build models that generalise."
 *   concepts:
 *     - gradient-descent
 *     - linear-regression
 *   heroDemoLabel: "Gradient Descent Visualizer"   # optional
 *   publishedAt: "2024-01-15"                       # ISO yyyy-mm-dd or null
 *   draft: false                                    # default false
 *   ---
 *
 * Validation lives here (and not inline in `config.ts`) so the rules are
 * testable in vitest without spinning up Astro. The Astro Content
 * Collection schema in `config.ts` calls into this validator via a
 * Zod `.transform()`.
 *
 * `concepts` is validated against the controlled vocabulary (plan §7.15)
 * — a `TagValidator` is injected so unit tests can use a small vocab.
 */

import type { TagValidator } from "./concepts/validator";

export interface CourseFrontmatter {
  title: string;
  term: string;
  oneLineTakeaway: string;
  concepts: string[];
  techTags: string[];
  heroDemoLabel?: string;
  publishedAt: string | null;
  draft: boolean;
  /**
   * When true, the course page renders the published structure (demos
   * woven into MDX, layout chrome, search facets) but with a visible
   * "Pre-interview preview" banner and no fabricated authorial prose.
   *
   * Used for the 8 v3–v10 courses while their author interviews are
   * pending. Defaults to false (= interview-reviewed content).
   */
  interviewPending: boolean;
}

export class CourseFrontmatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseFrontmatterError";
  }
}

export interface FrontmatterValidator {
  validate(input: unknown): CourseFrontmatter;
}

const TERM_RE = /^(SP|SU|FA|WI)\d{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TAKEAWAY_LEN = 200;
const MAX_TECH_TAGS = 8;

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    !Array.isArray(x) &&
    Object.getPrototypeOf(x) === Object.prototype
  );
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new CourseFrontmatterError(`${field}: expected string, got ${typeof value}`);
  }
  if (value.trim() === "") {
    throw new CourseFrontmatterError(`${field}: must be non-empty`);
  }
  return value;
}

function parsePublishedAt(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new CourseFrontmatterError(
      `publishedAt: expected string or null, got ${typeof value}`,
    );
  }
  if (!ISO_DATE_RE.test(value)) {
    throw new CourseFrontmatterError(
      `publishedAt: must be ISO yyyy-mm-dd, got ${JSON.stringify(value)}`,
    );
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new CourseFrontmatterError(
      `publishedAt: not a real calendar date: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function parseTechTags(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new CourseFrontmatterError(`techTags: expected array, got ${typeof value}`);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of value) {
    if (typeof t !== "string") {
      throw new CourseFrontmatterError(
        `techTags: each entry must be a string, got ${typeof t}`,
      );
    }
    if (t.trim() === "") {
      throw new CourseFrontmatterError(
        "techTags: entries must be non-empty / non-whitespace",
      );
    }
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  if (out.length > MAX_TECH_TAGS) {
    throw new CourseFrontmatterError(
      `techTags: at most ${MAX_TECH_TAGS} entries, got ${out.length}`,
    );
  }
  return out;
}

export function buildFrontmatterValidator(
  tagValidator: TagValidator,
): FrontmatterValidator {
  return {
    validate(input: unknown): CourseFrontmatter {
      if (!isPlainObject(input)) {
        throw new CourseFrontmatterError(
          `expected an object, got ${input === null ? "null" : typeof input}`,
        );
      }

      const title = requireNonEmptyString(input.title, "title");

      const termRaw = requireNonEmptyString(input.term, "term");
      if (!TERM_RE.test(termRaw)) {
        throw new CourseFrontmatterError(
          `term: must match /^(SP|SU|FA|WI)\\d{2}$/, got ${JSON.stringify(termRaw)}`,
        );
      }

      const takeaway = requireNonEmptyString(input.oneLineTakeaway, "oneLineTakeaway");
      if (takeaway.length > MAX_TAKEAWAY_LEN) {
        throw new CourseFrontmatterError(
          `oneLineTakeaway: must be ≤ ${MAX_TAKEAWAY_LEN} chars, got ${takeaway.length}`,
        );
      }

      const conceptsRaw = input.concepts ?? [];
      if (!Array.isArray(conceptsRaw)) {
        throw new CourseFrontmatterError(
          `concepts: expected array, got ${typeof conceptsRaw}`,
        );
      }
      for (const t of conceptsRaw) {
        if (typeof t !== "string") {
          throw new CourseFrontmatterError(
            `concepts: each entry must be a string, got ${typeof t}`,
          );
        }
      }
      let concepts: string[];
      try {
        concepts = tagValidator.validate(conceptsRaw as string[]);
      } catch (e) {
        throw new CourseFrontmatterError(`concepts: ${(e as Error).message}`);
      }

      let heroDemoLabel: string | undefined;
      if (input.heroDemoLabel !== undefined) {
        heroDemoLabel = requireNonEmptyString(input.heroDemoLabel, "heroDemoLabel");
      }

      const techTags = parseTechTags(input.techTags);

      const publishedAt = parsePublishedAt(input.publishedAt);

      let draft = false;
      if (input.draft !== undefined) {
        if (typeof input.draft !== "boolean") {
          throw new CourseFrontmatterError(
            `draft: expected boolean, got ${typeof input.draft}`,
          );
        }
        draft = input.draft;
      }

      let interviewPending = false;
      if (input.interviewPending !== undefined) {
        if (typeof input.interviewPending !== "boolean") {
          throw new CourseFrontmatterError(
            `interviewPending: expected boolean, got ${typeof input.interviewPending}`,
          );
        }
        interviewPending = input.interviewPending;
      }

      return {
        title,
        term: termRaw,
        oneLineTakeaway: takeaway,
        concepts,
        techTags,
        ...(heroDemoLabel !== undefined ? { heroDemoLabel } : {}),
        publishedAt,
        draft,
        interviewPending,
      };
    },
  };
}
