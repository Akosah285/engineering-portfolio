import { describe, expect, it } from "vitest";
import {
  type CatalogEntry,
  type MdxEntryLike,
  classifyCatalogMdxPair,
  selectIndexableCourses,
} from "../courseSelector";

const PUB_CATALOG: CatalogEntry = {
  slug: "ml",
  displayName: "Machine Learning",
  term: "SP20",
  displayOrder: 4,
  publishedAt: "2026-05-15",
};
const CS_CATALOG: CatalogEntry = {
  slug: "fourier",
  displayName: "Fourier Transforms",
  term: "FA20",
  displayOrder: 5,
  publishedAt: null,
};
const MECH_CATALOG: CatalogEntry = {
  slug: "mech",
  displayName: "Mechatronics",
  term: "SP21",
  displayOrder: 1,
  publishedAt: null,
};
const EMB_CATALOG: CatalogEntry = {
  slug: "emb",
  displayName: "Embedded Systems",
  term: "WI21",
  displayOrder: 2,
  publishedAt: null,
};

const pubMdx = (slug: string, concepts: readonly string[] = []): MdxEntryLike => ({
  slug,
  data: { draft: false, concepts },
});
const draftMdx = (slug: string, concepts: readonly string[] = []): MdxEntryLike => ({
  slug,
  data: { draft: true, concepts },
});

describe("classifyCatalogMdxPair", () => {
  it("returns 'published' for catalog.publishedAt non-null + mdx.draft false", () => {
    expect(classifyCatalogMdxPair(PUB_CATALOG, pubMdx("ml"))).toBe("published");
  });

  it("returns 'coming-soon' for catalog.publishedAt null + mdx.draft true", () => {
    expect(classifyCatalogMdxPair(CS_CATALOG, draftMdx("fourier"))).toBe("coming-soon");
  });

  it("returns 'inconsistent' when catalog says published but mdx is draft", () => {
    expect(classifyCatalogMdxPair(PUB_CATALOG, draftMdx("ml"))).toBe("inconsistent");
  });

  it("returns 'inconsistent' when catalog says coming-soon but mdx is published", () => {
    expect(classifyCatalogMdxPair(CS_CATALOG, pubMdx("fourier"))).toBe("inconsistent");
  });

  it("returns 'inconsistent' when no matching catalog entry exists (orphan MDX)", () => {
    expect(classifyCatalogMdxPair(undefined, pubMdx("orphan"))).toBe("inconsistent");
  });
});

describe("selectIndexableCourses", () => {
  describe("filtering by pair state", () => {
    it("returns [] when given empty inputs", () => {
      expect(selectIndexableCourses([], [])).toEqual([]);
    });

    it("includes a consistently-published course", () => {
      const result = selectIndexableCourses([PUB_CATALOG], [pubMdx("ml", ["x"])]);
      expect(result).toEqual([{ slug: "ml", concepts: ["x"], comingSoon: false }]);
    });

    it("includes a consistently-Coming-Soon course with comingSoon: true", () => {
      const result = selectIndexableCourses(
        [CS_CATALOG],
        [draftMdx("fourier", ["fourier-series"])],
      );
      expect(result).toEqual([
        { slug: "fourier", concepts: ["fourier-series"], comingSoon: true },
      ]);
    });

    it("drops an inconsistent course (catalog published, mdx draft)", () => {
      const result = selectIndexableCourses([PUB_CATALOG], [draftMdx("ml")]);
      expect(result).toEqual([]);
    });

    it("drops an inconsistent course (catalog coming-soon, mdx published)", () => {
      const result = selectIndexableCourses([CS_CATALOG], [pubMdx("fourier")]);
      expect(result).toEqual([]);
    });

    it("drops an MDX entry with no matching catalog row (orphan MDX)", () => {
      const result = selectIndexableCourses([PUB_CATALOG], [pubMdx("ghost")]);
      expect(result).toEqual([]);
    });

    it("silently ignores catalog rows that have no MDX entry (missing MDX)", () => {
      const result = selectIndexableCourses([PUB_CATALOG, CS_CATALOG], [pubMdx("ml")]);
      expect(result.map((c) => c.slug)).toEqual(["ml"]);
    });
  });

  describe("ordering by displayOrder", () => {
    it("orders the output by catalog.displayOrder ascending", () => {
      const catalog = [PUB_CATALOG, CS_CATALOG, MECH_CATALOG, EMB_CATALOG];
      const mdx = [
        draftMdx("fourier"), // displayOrder 5
        pubMdx("ml"), //         displayOrder 4
        draftMdx("emb"), //      displayOrder 2
        draftMdx("mech"), //     displayOrder 1
      ];
      const result = selectIndexableCourses(catalog, mdx);
      expect(result.map((c) => c.slug)).toEqual(["mech", "emb", "ml", "fourier"]);
    });

    it("stable-orders entries with identical displayOrder", () => {
      const tieA: CatalogEntry = { ...MECH_CATALOG, slug: "a", displayOrder: 1 };
      const tieB: CatalogEntry = { ...MECH_CATALOG, slug: "b", displayOrder: 1 };
      const result = selectIndexableCourses([tieA, tieB], [draftMdx("a"), draftMdx("b")]);
      expect(result.map((c) => c.slug)).toEqual(["a", "b"]);
    });
  });

  describe("integration with concept tags", () => {
    it("propagates concepts arrays untouched (no dedup, no filtering)", () => {
      const result = selectIndexableCourses(
        [CS_CATALOG],
        [draftMdx("fourier", ["fourier-series", "convolution", "fourier-series"])],
      );
      expect(result[0]?.concepts).toEqual([
        "fourier-series",
        "convolution",
        "fourier-series",
      ]);
    });

    it("preserves an empty concepts array", () => {
      const result = selectIndexableCourses([CS_CATALOG], [draftMdx("fourier", [])]);
      expect(result[0]?.concepts).toEqual([]);
    });
  });

  describe("purity", () => {
    it("does not mutate the input mdxEntries array", () => {
      const mdx = [draftMdx("fourier"), draftMdx("emb"), draftMdx("mech")];
      const snapshot = mdx.map((e) => e.slug);
      selectIndexableCourses([CS_CATALOG, EMB_CATALOG, MECH_CATALOG], mdx);
      expect(mdx.map((e) => e.slug)).toEqual(snapshot);
    });

    it("returns the same output for the same input on repeated calls", () => {
      const catalog = [PUB_CATALOG, CS_CATALOG];
      const mdx = [pubMdx("ml"), draftMdx("fourier")];
      const a = selectIndexableCourses(catalog, mdx);
      const b = selectIndexableCourses(catalog, mdx);
      expect(a).toEqual(b);
    });
  });
});
