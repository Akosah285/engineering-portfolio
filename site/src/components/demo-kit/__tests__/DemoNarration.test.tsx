import { render, screen } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DemoNarration } from "../DemoNarration";

interface DemoState {
  step: number;
  loss: number;
}

const template = (s: DemoState): string =>
  `Step ${s.step} with loss ${s.loss.toFixed(2)}.`;

describe("<DemoNarration>", () => {
  it("renders the template against initial state", () => {
    render(<DemoNarration state={{ step: 0, loss: 1.0 }} template={template} />);
    expect(screen.getByText("Step 0 with loss 1.00.")).toBeDefined();
  });

  it("uses an aria-live polite region for screen readers", () => {
    const { container } = render(
      <DemoNarration state={{ step: 0, loss: 1.0 }} template={template} />,
    );
    const region = container.querySelector("[aria-live]");
    expect(region).toBeDefined();
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("aria-atomic")).toBe("true");
  });

  it("uses role=status so SR's announce updates", () => {
    render(<DemoNarration state={{ step: 0, loss: 1.0 }} template={template} />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("updates rendered text when state changes", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [s, setS] = useState<DemoState>({ step: 0, loss: 1.0 });
      return (
        <>
          <DemoNarration state={s} template={template} />
          <button
            type="button"
            onClick={() => setS({ step: 1, loss: 0.5 })}
          >
            step
          </button>
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByText("Step 0 with loss 1.00.")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "step" }));
    expect(screen.getByText("Step 1 with loss 0.50.")).toBeDefined();
  });

  it("renders a visually-hidden variant when visuallyHidden is true", () => {
    const { container } = render(
      <DemoNarration
        state={{ step: 0, loss: 1.0 }}
        template={template}
        visuallyHidden
      />,
    );
    const p = container.querySelector("p");
    expect(p?.className).toContain("sr-only");
  });

  it("honours a custom className", () => {
    const { container } = render(
      <DemoNarration
        state={{ step: 0, loss: 1.0 }}
        template={template}
        className="my-custom"
      />,
    );
    expect(container.querySelector(".my-custom")).toBeDefined();
  });
});
