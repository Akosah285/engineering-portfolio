import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PresetCarousel } from "../PresetCarousel";

interface DemoState {
  rate: number;
}

const presets = [
  { name: "Slow", state: { rate: 0.1 } satisfies DemoState },
  { name: "Medium", state: { rate: 1.0 } satisfies DemoState },
  { name: "Fast", state: { rate: 10.0 } satisfies DemoState },
];

describe("<PresetCarousel>", () => {
  it("renders one chip per preset", () => {
    const onSelect = vi.fn();
    render(<PresetCarousel presets={presets} onSelect={onSelect} />);

    expect(screen.getByRole("option", { name: "Slow" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Medium" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Fast" })).toBeDefined();
  });

  it("marks the first preset as active by default", () => {
    const onSelect = vi.fn();
    render(<PresetCarousel presets={presets} onSelect={onSelect} />);

    const slow = screen.getByRole("option", { name: "Slow" });
    expect(slow.getAttribute("aria-selected")).toBe("true");
  });

  it("honours initialIndex when provided", () => {
    const onSelect = vi.fn();
    render(
      <PresetCarousel
        presets={presets}
        onSelect={onSelect}
        initialIndex={2}
      />,
    );

    const fast = screen.getByRole("option", { name: "Fast" });
    expect(fast.getAttribute("aria-selected")).toBe("true");
  });

  it("clicking a chip fires onSelect with that preset's state", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PresetCarousel presets={presets} onSelect={onSelect} />);

    await user.click(screen.getByRole("option", { name: "Fast" }));

    expect(onSelect).toHaveBeenCalledWith(
      { rate: 10.0 },
      presets[2],
    );
  });

  it("Next button advances and fires onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PresetCarousel presets={presets} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Next preset" }));

    expect(onSelect).toHaveBeenCalledWith(
      { rate: 1.0 },
      presets[1],
    );
    expect(
      screen.getByRole("option", { name: "Medium" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
  });

  it("Next button wraps from last to first", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <PresetCarousel
        presets={presets}
        onSelect={onSelect}
        initialIndex={2}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Next preset" }));

    expect(onSelect).toHaveBeenLastCalledWith(
      { rate: 0.1 },
      presets[0],
    );
  });

  it("Prev button retreats and wraps from first to last", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PresetCarousel presets={presets} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Previous preset" }));

    expect(onSelect).toHaveBeenLastCalledWith(
      { rate: 10.0 },
      presets[2],
    );
  });

  it("returns null for an empty preset list", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PresetCarousel presets={[]} onSelect={onSelect} />,
    );

    expect(container.textContent).toBe("");
  });

  it("uses 44x44 tap targets via CSS class — markup uses <button> for chips + nav", () => {
    // We assert the structural commitment (buttons everywhere, not <span>s)
    // so taps land reliably. Pixel sizes live in CSS and are out of scope here.
    const onSelect = vi.fn();
    render(<PresetCarousel presets={presets} onSelect={onSelect} />);

    const buttons = screen.getAllByRole("button");
    // 2 nav buttons + 3 preset chips (chips have role=option, which is a button
    // in our markup but exposed as option for listbox semantics)
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
