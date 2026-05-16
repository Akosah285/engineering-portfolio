import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SevenSegmentVisualizer } from "../SevenSegmentVisualizer";

describe("SevenSegmentVisualizer", () => {
  it("renders sliders + preset chips + canvas controls + text input", () => {
    render(<SevenSegmentVisualizer />);
    expect(screen.getByRole("slider", { name: /brightness/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /display text|text/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /count.0|count 0/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /hex/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
  });

  it("emits a segments-lit counter", () => {
    render(<SevenSegmentVisualizer />);
    const counter = document.querySelector(".sv-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/segments lit:\s*\d+/i);
  });
});
