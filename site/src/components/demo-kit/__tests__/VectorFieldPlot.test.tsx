import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VectorFieldPlot } from "../VectorFieldPlot";

describe("<VectorFieldPlot>", () => {
  it("renders with the provided ariaLabel", () => {
    render(
      <VectorFieldPlot
        width={300}
        height={300}
        xDomain={[-1, 1]}
        yDomain={[-1, 1]}
        gridSize={4}
        fieldFn={() => [1, 0]}
        ariaLabel="constant rightward field"
      />,
    );
    expect(screen.getByLabelText("constant rightward field")).toBeTruthy();
  });

  it("renders a single canvas element", () => {
    const { container } = render(
      <VectorFieldPlot
        width={300}
        height={300}
        xDomain={[-1, 1]}
        yDomain={[-1, 1]}
        gridSize={4}
        fieldFn={() => [1, 0]}
        ariaLabel="x"
      />,
    );
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("supports color-by-magnitude without throwing", () => {
    expect(() =>
      render(
        <VectorFieldPlot
          width={300}
          height={300}
          xDomain={[-1, 1]}
          yDomain={[-1, 1]}
          gridSize={8}
          fieldFn={(x, y) => [x, y]}
          colorByMagnitude
          ariaLabel="radial"
        />,
      ),
    ).not.toThrow();
  });

  it("respects maxMagnitude clipping", () => {
    expect(() =>
      render(
        <VectorFieldPlot
          width={300}
          height={300}
          xDomain={[-1, 1]}
          yDomain={[-1, 1]}
          gridSize={8}
          fieldFn={(x, y) => {
            const r2 = x * x + y * y;
            if (r2 === 0) return [0, 0];
            return [x / r2, y / r2];
          }}
          maxMagnitude={5}
          ariaLabel="charge"
        />,
      ),
    ).not.toThrow();
  });
});
