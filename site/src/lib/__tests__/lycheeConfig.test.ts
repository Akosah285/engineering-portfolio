import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Lychee config lives at site/lychee.toml. Vitest cwd is site/, so the
// path resolves relative to that. We parse it as text — TOML format is
// simple enough here that pulling in a parser is overkill, and the test
// stays focused on the contract (specific keys + values) rather than
// general TOML correctness.
const CONFIG_PATH = resolve(process.cwd(), "lychee.toml");
const WORKFLOW_PATH = resolve(process.cwd(), "..", ".github", "workflows", "lychee.yml");

function loadConfig(): string {
  return readFileSync(CONFIG_PATH, "utf8");
}

function loadWorkflow(): string {
  return readFileSync(WORKFLOW_PATH, "utf8");
}

describe("Lychee link-check config (site/lychee.toml)", () => {
  it("file exists and is non-empty", () => {
    const raw = loadConfig();
    expect(raw.length).toBeGreaterThan(0);
  });

  describe("accept codes (rate-limit / bot-detection tolerance)", () => {
    it("accepts 200 (default OK)", () => {
      expect(loadConfig()).toMatch(/accept\s*=\s*\[[^\]]*"200"/);
    });

    it("accepts 429 (rate-limited treated as healthy)", () => {
      expect(loadConfig()).toMatch(/accept\s*=\s*\[[^\]]*"429"/);
    });

    it("accepts 403 (LinkedIn / Cloudflare / X block bots; not actually broken)", () => {
      expect(loadConfig()).toMatch(/accept\s*=\s*\[[^\]]*"403"/);
    });
  });

  describe("exclude patterns", () => {
    it("excludes mailto: / tel:", () => {
      expect(loadConfig()).toMatch(/exclude_mail\s*=\s*true/);
    });

    it("excludes localhost (defensive — dev URLs shouldn't ship to dist)", () => {
      expect(loadConfig()).toMatch(/localhost/);
    });

    it("excludes github.com (rate-limited against unauthenticated CI)", () => {
      // TOML source has two literal backslashes before the dot
      // (`github\\.com`). JS string literal needs four backslashes to
      // express two literal ones.
      expect(loadConfig()).toContain("github\\\\.com");
    });

    it("excludes linkedin.com (blocks link-checker user agents)", () => {
      expect(loadConfig()).toContain("linkedin\\\\.com");
    });
  });

  describe("reliability knobs", () => {
    it("uses GET method (HEAD breaks Cloudflare / Substack and friends)", () => {
      expect(loadConfig()).toMatch(/method\s*=\s*"get"/);
    });

    it("caches results for 1 day to keep CI fast", () => {
      const raw = loadConfig();
      expect(raw).toMatch(/cache\s*=\s*true/);
      expect(raw).toMatch(/max_cache_age\s*=\s*"1d"/);
    });

    it("uses a reasonable concurrency cap", () => {
      const m = loadConfig().match(/max_concurrency\s*=\s*(\d+)/);
      expect(m).not.toBeNull();
      const n = Number(m![1]);
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(16);
    });

    it("has a reasonable per-request timeout", () => {
      const m = loadConfig().match(/timeout\s*=\s*(\d+)/);
      expect(m).not.toBeNull();
      const n = Number(m![1]);
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(60);
    });
  });

  describe("base URL points at the live site", () => {
    it("resolves relative links against the GH Pages prod URL", () => {
      expect(loadConfig()).toMatch(
        /base\s*=\s*"https:\/\/akosah285\.github\.io\/engineering-portfolio\/"/,
      );
    });
  });
});

describe("Lychee CI workflow (.github/workflows/lychee.yml)", () => {
  it("workflow file exists", () => {
    expect(() => loadWorkflow()).not.toThrow();
  });

  describe("v3 stage = warn-only per plan §2.13", () => {
    it("step uses continue-on-error: true", () => {
      expect(loadWorkflow()).toMatch(/continue-on-error:\s*true/);
    });

    it("lychee-action invoked with fail: false", () => {
      expect(loadWorkflow()).toMatch(/fail:\s*false/);
    });
  });

  describe("triggers", () => {
    it("runs on push to main", () => {
      expect(loadWorkflow()).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
    });

    it("runs on pull_request to main", () => {
      expect(loadWorkflow()).toMatch(/pull_request:\s*\n\s*branches:\s*\[main\]/);
    });

    it("supports workflow_dispatch (manual re-runs)", () => {
      expect(loadWorkflow()).toMatch(/workflow_dispatch:/);
    });

    it("runs on a weekly cron for external-link drift detection", () => {
      expect(loadWorkflow()).toMatch(/schedule:/);
      expect(loadWorkflow()).toMatch(/cron:/);
    });
  });

  describe("scans built site, not source", () => {
    it("builds the site before lychee runs", () => {
      const wf = loadWorkflow();
      const buildIdx = wf.indexOf("pnpm run build");
      const lycheeIdx = wf.indexOf("lycheeverse/lychee-action");
      expect(buildIdx).toBeGreaterThan(-1);
      expect(lycheeIdx).toBeGreaterThan(-1);
      expect(buildIdx).toBeLessThan(lycheeIdx);
    });

    it("passes site/dist/**/*.html to lychee", () => {
      expect(loadWorkflow()).toMatch(/site\/dist\/\*\*\/\*\.html/);
    });

    it("references the site/lychee.toml config", () => {
      expect(loadWorkflow()).toMatch(/site\/lychee\.toml/);
    });
  });

  describe("artifact upload", () => {
    it("uploads the lychee report so triage can inspect findings", () => {
      const wf = loadWorkflow();
      expect(wf).toMatch(/actions\/upload-artifact@v4/);
      expect(wf).toMatch(/name:\s*lychee-report/);
    });
  });
});
