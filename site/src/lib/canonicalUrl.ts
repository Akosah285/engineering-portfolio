/**
 * canonicalUrl — pure helper for building absolute, trailing-slash-correct
 * URLs from a site config + a request URL.
 *
 * Used by <HeadMeta> to emit `<link rel="canonical">` and Open Graph
 * `og:url`. Per plan §7.11, all course/concept routes use a trailing
 * slash; this helper preserves that contract.
 */

export interface SiteConfig {
  /** Site origin, no trailing slash. e.g. "https://akosah285.github.io" */
  origin: string;
  /** Base path with leading + trailing slash. e.g. "/engineering-portfolio/" */
  base: string;
}

/**
 * Build an absolute canonical URL for a given pathname.
 *
 * @param config Site origin + base path
 * @param pathname Pathname relative to the site root, e.g. "/courses/ml/"
 * @returns Absolute URL like "https://example.com/base/courses/ml/"
 */
export function canonicalUrl(config: SiteConfig, pathname: string): string {
  const origin = config.origin.replace(/\/+$/, "");
  // Normalise base: must have leading slash, trailing slash
  let base = config.base.startsWith("/") ? config.base : `/${config.base}`;
  if (!base.endsWith("/")) base += "/";

  // Strip leading slashes from pathname so we can join cleanly
  let path = pathname.replace(/^\/+/, "");

  // If path already begins with the base (e.g. "engineering-portfolio/x"),
  // don't double-stack it.
  const baseTrimmed = base.replace(/^\/+/, "").replace(/\/+$/, "");
  if (baseTrimmed && path.startsWith(`${baseTrimmed}/`)) {
    path = path.slice(baseTrimmed.length + 1);
  } else if (baseTrimmed && path === baseTrimmed) {
    path = "";
  }

  // Add trailing slash unless path is empty or already ends with one or
  // looks like a file (has a `.` after the last `/`).
  let normalised = `${origin}${base}${path}`;
  if (!normalised.endsWith("/")) {
    const lastSegment = normalised.split("/").pop() ?? "";
    if (!lastSegment.includes(".")) {
      normalised += "/";
    }
  }

  return normalised;
}
