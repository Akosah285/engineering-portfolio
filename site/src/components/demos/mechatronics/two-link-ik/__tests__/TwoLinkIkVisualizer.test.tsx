import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TwoLinkIkVisualizer } from "../TwoLinkIkVisualizer";

describe("TwoLinkIkVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<TwoLinkIkVisualizer />);
    expect(screen.getByRole("slider", { name: /^l1|^link 1/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^l2|^link 2/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^cycle speed|^speed/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /circle/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /square/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /figure.8|fig.8/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/kinematics|arm|link|elbow|joint/i);
  });

  it("emits a t counter", () => {
    render(<TwoLinkIkVisualizer />);
    const counter = document.querySelector(".ik-visualizer__counter");
    expect(counter).toBeTruthy();
    expect((counter?.textContent ?? "")).toMatch(/t\s*=\s*0/);
  });
});
