import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeastSquaresVisualizer } from "../LeastSquaresVisualizer";

describe("LeastSquaresVisualizer", () => {
  it("renders sliders, preset carousel, and canvas", () => {
    render(<LeastSquaresVisualizer />);
    expect(screen.getByRole("slider", { name: /noise/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /n points/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /linear/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeInTheDocument();
  });

  it("emits a points counter", () => {
    render(<LeastSquaresVisualizer />);
    expect(screen.getByText(/n = \d+ points/i)).toBeInTheDocument();
  });
});
