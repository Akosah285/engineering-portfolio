import { describe, expect, it } from "vitest";
import { buildGitHubSourceUrl } from "../demoChrome";

describe("buildGitHubSourceUrl", () => {
  describe("happy path", () => {
    it("composes repo + branch + path into a valid blob URL", () => {
      const url = buildGitHubSourceUrl(
        "https://github.com/Akosah285/engineering-portfolio",
        "site/src/components/demo-kit/CodeReveal.astro",
      );

      expect(url).toBe(
        "https://github.com/Akosah285/engineering-portfolio/blob/main/site/src/components/demo-kit/CodeReveal.astro",
      );
    });

    it("uses 'main' as the default branch", () => {
      const url = buildGitHubSourceUrl(
        "https://github.com/owner/repo",
        "src/foo.ts",
      );

      expect(url).toBe("https://github.com/owner/repo/blob/main/src/foo.ts");
    });

    it("respects a custom branch", () => {
      const url = buildGitHubSourceUrl(
        "https://github.com/owner/repo",
        "src/foo.ts",
        "develop",
      );

      expect(url).toBe("https://github.com/owner/repo/blob/develop/src/foo.ts");
    });
  });

  describe("input normalisation", () => {
    it("strips a trailing slash from repoBaseUrl", () => {
      const url = buildGitHubSourceUrl(
        "https://github.com/owner/repo/",
        "src/foo.ts",
      );

      expect(url).toBe("https://github.com/owner/repo/blob/main/src/foo.ts");
    });

    it("strips multiple trailing slashes from repoBaseUrl", () => {
      const url = buildGitHubSourceUrl(
        "https://github.com/owner/repo///",
        "src/foo.ts",
      );

      expect(url).toBe("https://github.com/owner/repo/blob/main/src/foo.ts");
    });

    it("strips a leading slash from demoSourcePath", () => {
      const url = buildGitHubSourceUrl(
        "https://github.com/owner/repo",
        "/src/foo.ts",
      );

      expect(url).toBe("https://github.com/owner/repo/blob/main/src/foo.ts");
    });

    it("strips multiple leading slashes from demoSourcePath", () => {
      const url = buildGitHubSourceUrl(
        "https://github.com/owner/repo",
        "///src/foo.ts",
      );

      expect(url).toBe("https://github.com/owner/repo/blob/main/src/foo.ts");
    });

    it("trims leading and trailing slashes from the branch", () => {
      const url = buildGitHubSourceUrl(
        "https://github.com/owner/repo",
        "src/foo.ts",
        "/feature/x/",
      );

      expect(url).toBe(
        "https://github.com/owner/repo/blob/feature/x/src/foo.ts",
      );
    });
  });

  describe("guards", () => {
    it("throws on empty repoBaseUrl", () => {
      expect(() =>
        buildGitHubSourceUrl("", "src/foo.ts"),
      ).toThrow(/repoBaseUrl/);
    });

    it("throws on empty demoSourcePath", () => {
      expect(() =>
        buildGitHubSourceUrl("https://github.com/owner/repo", ""),
      ).toThrow(/demoSourcePath/);
    });

    it("falls back to 'main' if branch is empty after trimming", () => {
      const url = buildGitHubSourceUrl(
        "https://github.com/owner/repo",
        "src/foo.ts",
        "///",
      );

      expect(url).toBe("https://github.com/owner/repo/blob/main/src/foo.ts");
    });
  });
});
