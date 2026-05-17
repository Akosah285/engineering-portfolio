import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// cspell config lives at the repo root (site/ is the vitest cwd).
const REPO_ROOT = resolve(process.cwd(), "..");
const CONFIG_PATH = resolve(REPO_ROOT, "cspell.json");
const WORKFLOW_PATH = resolve(REPO_ROOT, ".github", "workflows", "cspell.yml");
const DICT_DIR = resolve(REPO_ROOT, "dict");

interface CspellDictionaryDefinition {
  name: string;
  path: string;
  addWords?: boolean;
}

interface CspellConfig {
  version?: string;
  language?: string;
  files?: string[];
  ignorePaths?: string[];
  dictionaries?: string[];
  dictionaryDefinitions?: CspellDictionaryDefinition[];
}

function loadConfig(): CspellConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as CspellConfig;
}

function loadWorkflow(): string {
  return readFileSync(WORKFLOW_PATH, "utf8");
}

describe("cspell config (cspell.json)", () => {
  it("exists and parses as JSON", () => {
    expect(() => loadConfig()).not.toThrow();
  });

  it("targets en-US (matches publication audience)", () => {
    expect(loadConfig().language).toBe("en-US");
  });

  describe("file globs", () => {
    it("scans site source: TypeScript, TSX, Astro, MDX, Markdown", () => {
      const files = loadConfig().files ?? [];
      expect(files).toContain("site/src/**/*.{ts,tsx,astro,mdx,md}");
    });

    it("scans the OCR vault's Python source", () => {
      const files = loadConfig().files ?? [];
      expect(files).toContain("tools/ocr-vault/src/**/*.py");
    });

    it("scans top-level documentation", () => {
      const files = loadConfig().files ?? [];
      expect(files).toContain("README.md");
    });
  });

  describe("ignore paths", () => {
    it("excludes node_modules", () => {
      expect(loadConfig().ignorePaths).toContain("**/node_modules/**");
    });

    it("excludes build output (dist + .astro)", () => {
      const ignores = loadConfig().ignorePaths ?? [];
      expect(ignores).toContain("**/dist/**");
      expect(ignores).toContain("**/.astro/**");
    });

    it("excludes test files (would otherwise drown the report)", () => {
      const ignores = loadConfig().ignorePaths ?? [];
      expect(ignores).toContain("**/__tests__/**");
    });

    it("excludes data + archive (large binary / OCR sidecars)", () => {
      const ignores = loadConfig().ignorePaths ?? [];
      expect(ignores).toContain("data/**");
      expect(ignores).toContain("archive/**");
    });
  });

  describe("dictionaries", () => {
    it("registers the three custom dictionaries (dartmouth + technical + names)", () => {
      const dicts = loadConfig().dictionaries ?? [];
      expect(dicts).toContain("dartmouth");
      expect(dicts).toContain("technical");
      expect(dicts).toContain("names");
    });

    it("dictionary definitions point at files under dict/", () => {
      const defs = loadConfig().dictionaryDefinitions ?? [];
      for (const def of defs) {
        expect(def.path).toMatch(/^\.\/dict\//);
        // Resolve relative to repo root (where cspell.json sits).
        expect(existsSync(resolve(REPO_ROOT, def.path))).toBe(true);
      }
    });

    it("each dictionary file is non-empty", () => {
      for (const name of ["dartmouth", "technical", "names"]) {
        const txt = readFileSync(resolve(DICT_DIR, `${name}.txt`), "utf8");
        expect(txt.trim().length).toBeGreaterThan(0);
      }
    });
  });
});

describe("cspell CI workflow (.github/workflows/cspell.yml)", () => {
  it("workflow file exists", () => {
    expect(() => loadWorkflow()).not.toThrow();
  });

  describe("v3 stage = warn-only per plan §2.13", () => {
    it("step uses continue-on-error: true", () => {
      expect(loadWorkflow()).toMatch(/continue-on-error:\s*true/);
    });
  });

  describe("triggers", () => {
    it("runs on push to main", () => {
      expect(loadWorkflow()).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
    });

    it("runs on pull_request to main", () => {
      expect(loadWorkflow()).toMatch(/pull_request:\s*\n\s*branches:\s*\[main\]/);
    });

    it("supports workflow_dispatch", () => {
      expect(loadWorkflow()).toMatch(/workflow_dispatch:/);
    });
  });

  describe("cspell invocation", () => {
    it("pins major version (cspell@8) for reproducibility", () => {
      expect(loadWorkflow()).toMatch(/cspell@8/);
    });

    it("uses --no-progress for clean CI logs", () => {
      expect(loadWorkflow()).toMatch(/--no-progress/);
    });

    it("references the repo-root cspell.json", () => {
      expect(loadWorkflow()).toMatch(/--config\s+\.\/cspell\.json/);
    });
  });

  describe("artifact upload", () => {
    it("uploads the cspell report so triage can inspect findings", () => {
      const wf = loadWorkflow();
      expect(wf).toMatch(/actions\/upload-artifact@v4/);
      expect(wf).toMatch(/name:\s*cspell-report/);
    });
  });
});
