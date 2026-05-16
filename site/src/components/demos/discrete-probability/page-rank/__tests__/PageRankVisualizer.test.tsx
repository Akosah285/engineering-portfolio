import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageRankVisualizer } from "../PageRankVisualizer";

describe("PageRankVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<PageRankVisualizer />);
    expect(screen.getByRole("slider", { name: /^damping/i })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: /^max iterations|^iterations/i }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /linear chain/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /star/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /two.cluster|bridge/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /cycle/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/pagerank|rank|graph|damping|node/i);
  });

  it("emits a nodes/edges counter", () => {
    render(<PageRankVisualizer />);
    const counter = document.querySelector(".pr-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/\d+\s*nodes/);
  });
});
