import { describe, expect, it } from "vitest";
import { renderMath } from "../renderMath";

describe("renderMath", () => {
  describe("inline mode", () => {
    it("returns a string", () => {
      const html = renderMath("E = mc^2");
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
    });

    it("contains a KaTeX span tree", () => {
      const html = renderMath("E = mc^2");
      expect(html).toMatch(/class="[^"]*katex[^"]*"/);
    });

    it("uses inline mode by default (no katex-display class)", () => {
      const html = renderMath("E = mc^2");
      expect(html).not.toContain("katex-display");
    });

    it("renders math symbols (mc²)", () => {
      const html = renderMath("E = mc^2");
      expect(html).toContain("E");
      // KaTeX renders the m, c letters as <span>s
      expect(html).toMatch(/[Ee]/);
    });

    it("wraps output in a span with data-pagefind-ignore", () => {
      const html = renderMath("x^2");
      expect(html).toMatch(/<span[^>]*data-pagefind-ignore/);
    });

    it("wraps output in a span with class 'math-expression'", () => {
      const html = renderMath("x^2");
      expect(html).toMatch(/<span[^>]*class="[^"]*math-expression[^"]*"/);
    });

    it("emits a hidden raw-latex span for Pagefind indexing", () => {
      const html = renderMath("\\alpha + \\beta");
      // hidden span with the data-pagefind-body marker
      expect(html).toMatch(/<span[^>]*data-pagefind-body/);
      // raw latex must appear inside that hidden span (escape backslashes)
      expect(html).toContain("\\alpha + \\beta");
    });

    it("escapes HTML special chars in the hidden raw-latex span", () => {
      const html = renderMath("a < b > c & d");
      expect(html).toContain("&lt;");
      expect(html).toContain("&gt;");
      expect(html).toContain("&amp;");
    });

    it("never throws on malformed LaTeX (throwOnError: false)", () => {
      expect(() => renderMath("\\frac{1}")).not.toThrow();
    });
  });

  describe("display mode", () => {
    it("emits katex-display class when display=true", () => {
      const html = renderMath("\\int_0^\\infty e^{-x^2} dx", { display: true });
      expect(html).toContain("katex-display");
    });

    it("does not emit katex-display class when display=false", () => {
      const html = renderMath("x^2", { display: false });
      expect(html).not.toContain("katex-display");
    });

    it("still emits Pagefind raw-latex hidden span in display mode", () => {
      const html = renderMath("a^2 + b^2 = c^2", { display: true });
      expect(html).toMatch(/<span[^>]*data-pagefind-body/);
      expect(html).toContain("a^2 + b^2 = c^2");
    });

    it("wraps display math in 'math-expression--display' modifier class", () => {
      const html = renderMath("x^2", { display: true });
      expect(html).toMatch(/math-expression--display/);
    });
  });

  describe("output structure", () => {
    it("returns a single top-level wrapper span", () => {
      const html = renderMath("x");
      expect(html).toMatch(/^<span[^>]*math-expression/);
    });

    it("hidden pagefind span comes after the katex span tree", () => {
      const html = renderMath("y");
      const ignoreIdx = html.indexOf("data-pagefind-ignore");
      const bodyIdx = html.indexOf("data-pagefind-body");
      expect(ignoreIdx).toBeGreaterThan(-1);
      expect(bodyIdx).toBeGreaterThan(-1);
      // pagefind-ignore wraps the visible KaTeX, so it must appear before
      // the pagefind-body span that holds the raw LaTeX.
      expect(bodyIdx).toBeGreaterThan(ignoreIdx);
    });

    it("does not include any <script> tags (zero JS output)", () => {
      const html = renderMath("x^2 + y^2");
      expect(html).not.toMatch(/<script/i);
    });

    it("does not import KaTeX JS at runtime", () => {
      const html = renderMath("x");
      expect(html).not.toMatch(/import\s|require\(/);
    });

    it("handles empty latex without crashing", () => {
      const html = renderMath("");
      expect(typeof html).toBe("string");
      expect(html).toMatch(/<span[^>]*math-expression/);
    });
  });

  describe("Pagefind contract", () => {
    it("hidden raw-latex span is marked visually hidden", () => {
      const html = renderMath("\\pi");
      // The span carrying data-pagefind-body should also be visually hidden
      // (so it doesn't render to sighted users) — implementations may use
      // a class or inline style. We accept either.
      const match = html.match(/<span[^>]*data-pagefind-body[^>]*>/);
      expect(match).not.toBeNull();
      const attrs = match?.[0] ?? "";
      expect(attrs).toMatch(/(class="[^"]*(visually-hidden|sr-only|hidden)|aria-hidden|style="[^"]*display:\s*none|position:\s*absolute)/);
    });

    it("the visible katex tree is wrapped in data-pagefind-ignore", () => {
      const html = renderMath("\\sum_{i=1}^n i");
      const m = html.match(
        /<span[^>]*data-pagefind-ignore[^>]*>[\s\S]*?<\/span>/,
      );
      expect(m).not.toBeNull();
      // Must contain a katex span inside the ignore wrapper.
      expect(m?.[0]).toMatch(/class="[^"]*katex[^"]*"/);
    });
  });
});
