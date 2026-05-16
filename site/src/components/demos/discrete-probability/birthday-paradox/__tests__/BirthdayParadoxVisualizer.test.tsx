import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BirthdayParadoxVisualizer } from "../BirthdayParadoxVisualizer";

describe("BirthdayParadoxVisualizer", () => {
  it("renders sliders + preset chips + canvas", () => {
    render(<BirthdayParadoxVisualizer />);
    expect(screen.getByRole("slider", { name: /^days in year|^days/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^max n|^maximum/i })).toBeTruthy();
    expect(screen.getByRole("slider", { name: /^target/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /classic/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /hash collision/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /big year/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /⏸ pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /↺ reset/i })).toBeTruthy();
    const narrations = screen.getAllByRole("status");
    const text = narrations.map((n) => n.textContent ?? "").join(" ");
    expect(text).toMatch(/birthday|collision|probability|paradox/i);
  });

  it("emits an n counter starting at 1", () => {
    render(<BirthdayParadoxVisualizer />);
    const counter = document.querySelector(".bp-visualizer__counter");
    expect(counter).toBeTruthy();
    expect(counter?.textContent ?? "").toMatch(/n\s*=\s*1/);
  });
});
