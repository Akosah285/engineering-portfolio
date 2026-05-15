import katex from "katex";

export interface RenderMathOptions {
  display?: boolean;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * Render LaTeX to a Pagefind-aware, SSR-friendly HTML string.
 *
 * Structure:
 *   <span class="math-expression[ math-expression--display]">
 *     <span data-pagefind-ignore>...katex html...</span>
 *     <span class="visually-hidden" data-pagefind-body>raw latex</span>
 *   </span>
 *
 * No JavaScript, no script tags, no runtime KaTeX dependency in the browser.
 */
export function renderMath(latex: string, opts: RenderMathOptions = {}): string {
  const display = opts.display === true;
  const katexHtml = katex.renderToString(latex, {
    displayMode: display,
    throwOnError: false,
    output: "html",
    strict: "ignore",
  });

  const wrapperClass = display
    ? "math-expression math-expression--display"
    : "math-expression";

  return [
    `<span class="${wrapperClass}">`,
    `<span data-pagefind-ignore="all">${katexHtml}</span>`,
    `<span class="visually-hidden" data-pagefind-body>${escapeHtml(latex)}</span>`,
    `</span>`,
  ].join("");
}
