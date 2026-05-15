/**
 * Helpers for the <DemoChrome> primitive.
 *
 * The chrome always renders a "View on GitHub" link pointing at the
 * algorithm source of the demo it wraps. This helper normalises the
 * inputs so callers don't have to think about trailing slashes or
 * leading slashes when wiring up the link.
 */

/**
 * Build a fully-qualified GitHub URL for a demo's source file.
 *
 * @param repoBaseUrl  e.g. "https://github.com/owner/repo"
 *                     Trailing slash is stripped.
 * @param branch       e.g. "main". Defaults to "main".
 * @param demoSourcePath  Repo-relative path,
 *                     e.g. "site/src/components/demo-kit/CodeReveal.astro".
 *                     Leading slash is stripped.
 *
 * @returns A `/blob/{branch}/{demoSourcePath}` URL on the given repo.
 *
 * @throws If `repoBaseUrl` or `demoSourcePath` is empty.
 */
export function buildGitHubSourceUrl(
  repoBaseUrl: string,
  demoSourcePath: string,
  branch = "main",
): string {
  if (!repoBaseUrl) {
    throw new Error("buildGitHubSourceUrl: repoBaseUrl must not be empty");
  }
  if (!demoSourcePath) {
    throw new Error("buildGitHubSourceUrl: demoSourcePath must not be empty");
  }

  const base = repoBaseUrl.replace(/\/+$/, "");
  const path = demoSourcePath.replace(/^\/+/, "");
  const safeBranch = branch.replace(/^\/+|\/+$/g, "") || "main";

  return `${base}/blob/${safeBranch}/${path}`;
}
