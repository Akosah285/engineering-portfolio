import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlotPanel } from "../PlotPanel";

describe("<PlotPanel>", () => {
  it("renders axis tick labels for both axes", () => {
    render(
      <PlotPanel
        width={400}
        height={300}
        xDomain={[0, 10]}
        yDomain={[0, 1]}
        series={[
          {
            id: "s",
            color: "#000",
            points: [
              [0, 0],
              [10, 1],
            ],
          },
        ]}
        ariaLabel="test plot"
      />,
    );
    // Both endpoints should appear as labels.
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("uses ariaLabel for the plot container", () => {
    render(
      <PlotPanel
        width={400}
        height={300}
        xDomain={[0, 1]}
        yDomain={[0, 1]}
        series={[]}
        ariaLabel="convergence plot"
      />,
    );
    expect(screen.getByLabelText("convergence plot")).toBeTruthy();
  });

  it("renders the optional x and y labels when provided", () => {
    render(
      <PlotPanel
        width={400}
        height={300}
        xDomain={[0, 1]}
        yDomain={[0, 1]}
        series={[]}
        xLabel="iteration"
        yLabel="loss"
        ariaLabel="t"
      />,
    );
    expect(screen.getByText("iteration")).toBeTruthy();
    expect(screen.getByText("loss")).toBeTruthy();
  });

  it("supports log-scale axes without throwing", () => {
    render(
      <PlotPanel
        width={400}
        height={300}
        xDomain={[1, 1000]}
        yDomain={[0.01, 100]}
        series={[]}
        logX
        logY
        ariaLabel="log plot"
      />,
    );
    // Pure smoke: just confirm it renders. Log-axis math is covered by plotPanel.test.ts.
    expect(screen.getByLabelText("log plot")).toBeTruthy();
  });
});
