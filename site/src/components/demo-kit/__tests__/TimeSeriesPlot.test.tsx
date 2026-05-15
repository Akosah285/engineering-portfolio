import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimeSeriesPlot } from "../TimeSeriesPlot";
import { createRingBuffer, pushSample } from "../timeSeries";

function buildBuffer(samples: Array<{ t: number; value: number }>) {
  let buf = createRingBuffer(samples.length + 1);
  for (const s of samples) buf = pushSample(buf, s);
  return buf;
}

describe("<TimeSeriesPlot>", () => {
  it("renders with the provided ariaLabel", () => {
    const buf = buildBuffer([
      { t: 0, value: 0 },
      { t: 1, value: 1 },
    ]);
    render(
      <TimeSeriesPlot
        width={500}
        height={200}
        series={[{ id: "s", buffer: buf, color: "#000" }]}
        now={1}
        windowSeconds={5}
        yDomain={[0, 1]}
        ariaLabel="sine wave"
      />,
    );
    expect(screen.getByLabelText("sine wave")).toBeTruthy();
  });

  it("uses the window endpoints as the x-axis domain", () => {
    const buf = buildBuffer([
      { t: 0, value: 0 },
      { t: 5, value: 1 },
    ]);
    render(
      <TimeSeriesPlot
        width={500}
        height={200}
        series={[{ id: "s", buffer: buf, color: "#000" }]}
        now={5}
        windowSeconds={5}
        yDomain={[0, 1]}
        xLabel="time (s)"
        yLabel="amplitude"
        ariaLabel="x"
      />,
    );
    // PlotPanel renders the domain endpoints as tick labels. "0" appears
    // on both the x and y axes (window starts at 0, y starts at 0), so use
    // getAllByText for the shared value and getByText for the unique one.
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("time (s)")).toBeTruthy();
    expect(screen.getByText("amplitude")).toBeTruthy();
  });

  it("supports the 'follow' y-domain without throwing", () => {
    const buf = buildBuffer([
      { t: 0, value: -3 },
      { t: 1, value: 7 },
    ]);
    expect(() =>
      render(
        <TimeSeriesPlot
          width={500}
          height={200}
          series={[{ id: "s", buffer: buf, color: "#000" }]}
          now={1}
          windowSeconds={5}
          yDomain="follow"
          ariaLabel="follow"
        />,
      ),
    ).not.toThrow();
  });

  it("renders without crashing on an empty buffer", () => {
    const buf = createRingBuffer(10);
    expect(() =>
      render(
        <TimeSeriesPlot
          width={500}
          height={200}
          series={[{ id: "s", buffer: buf, color: "#000" }]}
          now={0}
          windowSeconds={5}
          yDomain="follow"
          ariaLabel="empty"
        />,
      ),
    ).not.toThrow();
  });
});
