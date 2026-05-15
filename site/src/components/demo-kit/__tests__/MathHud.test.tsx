import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MathHud } from "../MathHud";

describe("<MathHud>", () => {
  it("renders one line per LaTeX expression", () => {
    const { container } = render(
      <MathHud lines={["\\eta = 0.05", "t = 12"]} />,
    );
    const items = container.querySelectorAll(".math-hud__line");
    expect(items.length).toBe(2);
  });

  it("uses a group role with a labelled name", () => {
    render(<MathHud lines={["x = 1"]} />);
    const group = screen.getByRole("group", { name: /current parameters/i });
    expect(group).toBeDefined();
  });

  it("returns null when given an empty lines array", () => {
    const { container } = render(<MathHud lines={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies corner-specific class by default", () => {
    const { container } = render(
      <MathHud lines={["x = 1"]} corner="bottom-left" />,
    );
    const hud = container.querySelector(".math-hud");
    expect(hud?.className).toContain("math-hud--bottom-left");
  });

  it("defaults to the top-right corner", () => {
    const { container } = render(<MathHud lines={["x = 1"]} />);
    const hud = container.querySelector(".math-hud");
    expect(hud?.className).toContain("math-hud--top-right");
  });

  it("honours a custom className override", () => {
    const { container } = render(
      <MathHud lines={["x = 1"]} className="my-hud" />,
    );
    expect(container.querySelector(".my-hud")).toBeDefined();
    expect(container.querySelector(".math-hud--top-right")).toBeNull();
  });

  it("renders KaTeX HTML output (katex class present)", () => {
    const { container } = render(<MathHud lines={["\\eta = 0.05"]} />);
    // renderMath produces output with .katex spans
    const html = container.innerHTML;
    expect(html.includes("katex")).toBe(true);
  });
});
