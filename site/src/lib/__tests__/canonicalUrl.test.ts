import { describe, expect, it } from "vitest";
import { type SiteConfig, canonicalUrl } from "../canonicalUrl";

const SITE: SiteConfig = {
  origin: "https://akosah285.github.io",
  base: "/engineering-portfolio/",
};

describe("canonicalUrl", () => {
  it("emits the root URL for the bare base", () => {
    expect(canonicalUrl(SITE, "/engineering-portfolio/")).toBe(
      "https://akosah285.github.io/engineering-portfolio/",
    );
  });

  it("appends a course path with trailing slash", () => {
    expect(canonicalUrl(SITE, "/engineering-portfolio/courses/machine-learning/")).toBe(
      "https://akosah285.github.io/engineering-portfolio/courses/machine-learning/",
    );
  });

  it("adds a trailing slash when the path is missing one", () => {
    expect(canonicalUrl(SITE, "/engineering-portfolio/about")).toBe(
      "https://akosah285.github.io/engineering-portfolio/about/",
    );
  });

  it("preserves file-like paths without adding a trailing slash", () => {
    expect(canonicalUrl(SITE, "/engineering-portfolio/sitemap.xml")).toBe(
      "https://akosah285.github.io/engineering-portfolio/sitemap.xml",
    );
  });

  it("does not double-stack the base when pathname already begins with it", () => {
    // Astro often passes the full pathname including base
    expect(canonicalUrl(SITE, "/engineering-portfolio/concepts/gradient-descent/")).toBe(
      "https://akosah285.github.io/engineering-portfolio/concepts/gradient-descent/",
    );
  });

  it("strips trailing slashes from origin", () => {
    const cfg: SiteConfig = {
      origin: "https://example.com/",
      base: "/site/",
    };
    expect(canonicalUrl(cfg, "/site/")).toBe("https://example.com/site/");
  });

  it("normalises a base missing the leading slash", () => {
    const cfg: SiteConfig = {
      origin: "https://example.com",
      base: "site/",
    };
    expect(canonicalUrl(cfg, "/site/foo/")).toBe("https://example.com/site/foo/");
  });

  it("normalises a base missing the trailing slash", () => {
    const cfg: SiteConfig = {
      origin: "https://example.com",
      base: "/site",
    };
    expect(canonicalUrl(cfg, "/site/")).toBe("https://example.com/site/");
  });

  it("works when the site is hosted at the root (base = '/')", () => {
    const cfg: SiteConfig = {
      origin: "https://example.com",
      base: "/",
    };
    expect(canonicalUrl(cfg, "/")).toBe("https://example.com/");
    expect(canonicalUrl(cfg, "/courses/ml/")).toBe("https://example.com/courses/ml/");
  });

  it("handles pathname without leading slash", () => {
    expect(canonicalUrl(SITE, "courses/foo/")).toBe(
      "https://akosah285.github.io/engineering-portfolio/courses/foo/",
    );
  });
});
