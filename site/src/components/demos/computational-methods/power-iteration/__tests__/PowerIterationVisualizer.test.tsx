import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PowerIterationVisualizer } from "../PowerIterationVisualizer";

describe("PowerIterationVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<PowerIterationVisualizer />);
    expect(screen.getByRole("slider", { name: /step delay/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /max iterations/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /symmetric/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeInTheDocument();
  });

  it("starts iteration counter at 0", () => {
    render(<PowerIterationVisualizer />);
    expect(screen.getByText(/iteration 0/i)).toBeInTheDocument();
  });
});
