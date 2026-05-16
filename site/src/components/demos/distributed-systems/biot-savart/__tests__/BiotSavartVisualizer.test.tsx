import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BiotSavartVisualizer from "../BiotSavartVisualizer";

describe("BiotSavartVisualizer", () => {
  it("renders sliders, preset carousel, and canvas controls", () => {
    render(<BiotSavartVisualizer />);
    expect(screen.getByRole("slider", { name: /^I\b|current/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^R\b|radius/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /nSegments|segments/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /grid/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /carrier|geometry/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /single.loop/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /helmholtz/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a max-Bz counter", () => {
    const { container } = render(<BiotSavartVisualizer />);
    const counter = container.querySelector(".bs-visualizer__counter");
    expect(counter).not.toBeNull();
    expect(counter?.textContent ?? "").toMatch(/Bz|max|T|tesla|µT|μT/i);
  });
});
