import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DcMotorVisualizer } from "../DcMotorVisualizer";

describe("DcMotorVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<DcMotorVisualizer />);
    expect(screen.getByRole("slider", { name: /voltage/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /km/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /tau|τ/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /small.hobby|small hobby/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeInTheDocument();
  });

  it("emits a voltage counter", () => {
    render(<DcMotorVisualizer />);
    expect(screen.getByText(/V = -?\d/i)).toBeInTheDocument();
  });
});
