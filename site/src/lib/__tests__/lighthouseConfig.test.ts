import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Lighthouse CI config lives at the repo's `site/` root. The vitest cwd
// is `site/` so the relative path is just the filename.
const CONFIG_PATH = resolve(process.cwd(), "lighthouserc.json");

type LhciAssertion =
  | "off"
  | "warn"
  | "error"
  | ["off" | "warn" | "error"]
  | ["off" | "warn" | "error", { minScore?: number; maxNumericValue?: number }];

interface LhciAssertMatrixEntry {
  matchingUrlPattern?: string;
  preset?: string;
  assertions?: Record<string, LhciAssertion>;
}

interface LhciConfig {
  ci: {
    collect: {
      startServerCommand?: string;
      startServerReadyPattern?: string;
      url?: string[];
      numberOfRuns?: number;
      settings?: Record<string, unknown>;
    };
    assert: {
      preset?: string;
      assertions?: Record<string, LhciAssertion>;
      assertMatrix?: LhciAssertMatrixEntry[];
    };
    upload?: Record<string, unknown>;
  };
}

function loadConfig(): LhciConfig {
  const raw = readFileSync(CONFIG_PATH, "utf8");
  return JSON.parse(raw) as LhciConfig;
}

function severityOf(assertion: LhciAssertion): string {
  if (typeof assertion === "string") return assertion;
  return assertion[0];
}

function thresholdOf(assertion: LhciAssertion): {
  minScore?: number;
  maxNumericValue?: number;
} {
  if (typeof assertion === "string") return {};
  if (assertion.length === 1) return {};
  return assertion[1];
}

function findAssertion(
  config: LhciConfig,
  matchingPattern: string | null,
  audit: string,
): LhciAssertion | undefined {
  const matrix = config.ci.assert.assertMatrix ?? [];
  if (matchingPattern === null) {
    const fallback = config.ci.assert.assertions;
    return fallback?.[audit];
  }
  const entry = matrix.find((e) => e.matchingUrlPattern === matchingPattern);
  return entry?.assertions?.[audit];
}

describe("Lighthouse CI configuration (lighthouserc.json)", () => {
  it("exists and parses as JSON", () => {
    expect(() => loadConfig()).not.toThrow();
  });

  describe("collect", () => {
    it("starts the Astro preview server with the project's base prefix", () => {
      const config = loadConfig();
      const cmd = config.ci.collect.startServerCommand ?? "";
      expect(cmd).toContain("astro preview");
      expect(cmd).toContain("4321");
    });

    it("runs 3 Lighthouse runs per URL (variance reduction per rubber-duck #5)", () => {
      const config = loadConfig();
      expect(config.ci.collect.numberOfRuns).toBe(3);
    });

    it("exercises the four representative URLs: landing + about + ML (published) + Fourier (Coming-Soon)", () => {
      const config = loadConfig();
      const urls = config.ci.collect.url ?? [];
      expect(urls).toEqual(
        expect.arrayContaining([
          "http://localhost:4321/engineering-portfolio/",
          "http://localhost:4321/engineering-portfolio/about/",
          "http://localhost:4321/engineering-portfolio/courses/machine-learning/",
          "http://localhost:4321/engineering-portfolio/courses/fourier-transforms/",
        ]),
      );
    });
  });

  describe("assert severity (v3 stage = warn-only per plan §2.13)", () => {
    it("every assertion in the global block uses severity 'warn' (not 'error')", () => {
      const config = loadConfig();
      const globals = config.ci.assert.assertions ?? {};
      for (const [audit, assertion] of Object.entries(globals)) {
        expect(severityOf(assertion)).toBe("warn");
      }
    });

    it("every assertion inside assertMatrix entries uses severity 'warn'", () => {
      const config = loadConfig();
      const matrix = config.ci.assert.assertMatrix ?? [];
      for (const entry of matrix) {
        for (const assertion of Object.values(entry.assertions ?? {})) {
          expect(severityOf(assertion)).toBe("warn");
        }
      }
    });
  });

  describe("global budgets match plan §7.5", () => {
    it("performance score ≥ 0.95", () => {
      const a = findAssertion(loadConfig(), null, "categories:performance");
      expect(a).toBeDefined();
      expect(thresholdOf(a!).minScore).toBe(0.95);
    });

    it("accessibility score ≥ 0.95", () => {
      const a = findAssertion(loadConfig(), null, "categories:accessibility");
      expect(a).toBeDefined();
      expect(thresholdOf(a!).minScore).toBe(0.95);
    });

    it("best-practices score ≥ 0.95", () => {
      const a = findAssertion(loadConfig(), null, "categories:best-practices");
      expect(a).toBeDefined();
      expect(thresholdOf(a!).minScore).toBe(0.95);
    });

    it("seo score ≥ 0.95", () => {
      const a = findAssertion(loadConfig(), null, "categories:seo");
      expect(a).toBeDefined();
      expect(thresholdOf(a!).minScore).toBe(0.95);
    });

    it("CLS ≤ 0.05", () => {
      const a = findAssertion(loadConfig(), null, "cumulative-layout-shift");
      expect(a).toBeDefined();
      expect(thresholdOf(a!).maxNumericValue).toBe(0.05);
    });

    it("total-blocking-time ≤ 200ms (INP proxy per rubber-duck note)", () => {
      const a = findAssertion(loadConfig(), null, "total-blocking-time");
      expect(a).toBeDefined();
      expect(thresholdOf(a!).maxNumericValue).toBe(200);
    });

    it("LCP default budget for course pages = 1500ms", () => {
      const a = findAssertion(loadConfig(), null, "largest-contentful-paint");
      expect(a).toBeDefined();
      expect(thresholdOf(a!).maxNumericValue).toBe(1500);
    });
  });

  describe("per-URL LCP overrides via assertMatrix (rubber-duck blocking #2)", () => {
    it("landing page (matched by exact pattern) has tighter LCP budget = 1200ms", () => {
      const config = loadConfig();
      const matrix = config.ci.assert.assertMatrix ?? [];
      const landingEntry = matrix.find(
        (e) =>
          typeof e.matchingUrlPattern === "string" &&
          e.matchingUrlPattern.includes("engineering-portfolio") &&
          // landing pattern must NOT match course or about routes
          !e.matchingUrlPattern.includes("courses") &&
          !e.matchingUrlPattern.includes("about"),
      );
      expect(landingEntry).toBeDefined();
      const lcp = landingEntry?.assertions?.["largest-contentful-paint"];
      expect(lcp).toBeDefined();
      expect(thresholdOf(lcp!).maxNumericValue).toBe(1200);
    });
  });

  describe("upload", () => {
    it("uploads to temporary public storage (no LHCI server)", () => {
      const config = loadConfig();
      expect(config.ci.upload?.target).toBe("temporary-public-storage");
    });
  });
});
