import { describe, expect, it } from "vitest";
import { type NarrationTemplate, renderNarration } from "../narrationTemplate";

interface DemoState {
  rate: number;
  label: string;
}

describe("renderNarration", () => {
  it("runs the template with the given state", () => {
    const tmpl: NarrationTemplate<DemoState> = (s) => `Rate is ${s.rate} (${s.label}).`;
    expect(renderNarration({ rate: 1.5, label: "fast" }, tmpl)).toBe(
      "Rate is 1.5 (fast).",
    );
  });

  it("trims surrounding whitespace from the rendered sentence", () => {
    const tmpl: NarrationTemplate<DemoState> = () => "   leading and trailing   ";
    expect(renderNarration({ rate: 0, label: "" }, tmpl)).toBe("leading and trailing");
  });

  it("returns an empty string when the template produces only whitespace", () => {
    const tmpl: NarrationTemplate<DemoState> = () => "   \n  \t ";
    expect(renderNarration({ rate: 0, label: "" }, tmpl)).toBe("");
  });

  it("returns an empty string when the template returns a non-string", () => {
    const tmpl = (() => undefined) as unknown as NarrationTemplate<DemoState>;
    expect(renderNarration({ rate: 0, label: "" }, tmpl)).toBe("");
  });

  it("treats every state object as independent (no caching)", () => {
    let calls = 0;
    const tmpl: NarrationTemplate<DemoState> = (s) => {
      calls += 1;
      return `call ${calls} with ${s.rate}`;
    };
    expect(renderNarration({ rate: 1, label: "" }, tmpl)).toBe("call 1 with 1");
    expect(renderNarration({ rate: 1, label: "" }, tmpl)).toBe("call 2 with 1");
    expect(renderNarration({ rate: 2, label: "" }, tmpl)).toBe("call 3 with 2");
  });

  it("supports complex state shapes (arrays, nested objects)", () => {
    interface Wave {
      freq: number;
      harmonics: number[];
      style: { color: string };
    }
    const tmpl: NarrationTemplate<Wave> = (s) =>
      `${s.style.color} wave at ${s.freq} Hz with ${s.harmonics.length} harmonics`;
    expect(
      renderNarration(
        { freq: 440, harmonics: [1, 3, 5], style: { color: "pine" } },
        tmpl,
      ),
    ).toBe("pine wave at 440 Hz with 3 harmonics");
  });
});
