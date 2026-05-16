import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkovChainVisualizer } from "../MarkovChainVisualizer";

describe("MarkovChainVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<MarkovChainVisualizer />);
    expect(screen.getByRole("slider", { name: /^step delay/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /weather/i })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /rock.paper.scissors/i }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /random walk/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /absorbing/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/markov|chain|distribut|stationary/i);
  });

  it("emits a step counter starting at 0", () => {
    render(<MarkovChainVisualizer />);
    const counter = document.querySelector(".mk-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/step\s*0/);
  });
});
