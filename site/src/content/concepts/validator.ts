/**
 * Concept tag validator — controlled vocabulary for `concepts: Tag[]`.
 *
 * Per plan §7.15, every course's "Concepts learned" section is constrained
 * to a curated tag list (lives in `_tags.json`). This validator keeps the
 * vocabulary clean by:
 *
 * 1. Refusing unknown tags
 * 2. Capping at MAX_TAGS_PER_COURSE (5) per course
 * 3. Validating tag shape (kebab-case)
 *
 * Used by Astro Content Collection schema at build time. Errors halt the build.
 */

export const MAX_TAGS_PER_COURSE = 5;

export class TagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TagValidationError";
  }
}

export interface TagValidator {
  validate(tags: readonly string[]): string[];
  isKnown(tag: string): boolean;
  knownTags(): string[];
}

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** True iff `s` is kebab-case (lowercase, single-hyphen, no leading/trailing hyphen). */
export function isKebabCase(s: string): boolean {
  return s.length > 0 && KEBAB_RE.test(s);
}

/**
 * Build a tag validator from a controlled vocabulary.
 *
 * @throws Error if the vocabulary contains non-kebab-case entries or duplicates.
 */
export function buildTagValidator(vocabulary: readonly string[]): TagValidator {
  const seen = new Set<string>();
  for (const t of vocabulary) {
    if (!isKebabCase(t)) {
      throw new Error(
        `Tag vocabulary entry must be kebab-case, got ${JSON.stringify(t)}`,
      );
    }
    if (seen.has(t)) {
      throw new Error(`duplicate tag in vocabulary: ${JSON.stringify(t)}`);
    }
    seen.add(t);
  }

  const known = new Set(vocabulary);

  return {
    validate(tags) {
      const deduped = Array.from(new Set(tags));

      if (deduped.length > MAX_TAGS_PER_COURSE) {
        throw new TagValidationError(
          `Each course may have at most ${MAX_TAGS_PER_COURSE} tags; got ${deduped.length}: ${JSON.stringify(deduped)}`,
        );
      }

      const unknown = deduped.filter((t) => !known.has(t));
      if (unknown.length > 0) {
        throw new TagValidationError(
          `Unknown tag(s): ${JSON.stringify(unknown)}. Add to _tags.json or fix the spelling.`,
        );
      }

      return deduped;
    },
    isKnown(tag) {
      return known.has(tag);
    },
    knownTags() {
      return [...vocabulary].sort();
    },
  };
}
