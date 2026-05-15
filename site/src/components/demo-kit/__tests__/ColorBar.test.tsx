import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ColorBar } from "../ColorBar";
import { viridis, rdbu } from "../colorMap";

describe("<ColorBar>", () => {
  it("renders tick labels at the requested min/max", () => {
    render(
      <ColorBar
        min={0}
        max={100}
        colorMap={viridis}
        ariaLabel="temperature"
      />,
    );
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("uses the ariaLabel for the colour bar container", () => {
    render(
      <ColorBar
        min={0}
        max={1}
        colorMap={viridis}
        ariaLabel="velocity magnitude"
      />,
    );
    expect(screen.getByLabelText("velocity magnitude")).toBeTruthy();
  });

  it("renders the optional label text when provided", () => {
    render(
      <ColorBar
        min={0}
        max={1}
        colorMap={rdbu}
        label="charge density"
        ariaLabel="x"
      />,
    );
    expect(screen.getByText("charge density")).toBeTruthy();
  });

  it("supports horizontal orientation", () => {
    const { container } = render(
      <ColorBar
        min={0}
        max={1}
        colorMap={viridis}
        orientation="horizontal"
        ariaLabel="x"
      />,
    );
    const root = container.querySelector(".color-bar--horizontal");
    expect(root).toBeTruthy();
  });

  it("works with both built-in colour maps without throwing", () => {
    expect(() =>
      render(<ColorBar min={-1} max={1} colorMap={rdbu} ariaLabel="diverging" />),
    ).not.toThrow();
    expect(() =>
      render(<ColorBar min={0} max={10} colorMap={viridis} ariaLabel="sequential" />),
    ).not.toThrow();
  });
});
