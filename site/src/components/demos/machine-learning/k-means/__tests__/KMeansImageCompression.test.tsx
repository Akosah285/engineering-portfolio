import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KMeansImageCompression } from "../KMeansImageCompression";

afterEach(() => {
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/");
  }
});

describe("<KMeansImageCompression>", () => {
  it("renders sample chips, sliders, and two canvases", () => {
    const { container, getByLabelText } = render(<KMeansImageCompression />);
    expect(getByLabelText(/Number of clusters K/i)).toBeTruthy();
    expect(getByLabelText(/Seed/i)).toBeTruthy();
    const canvases = container.querySelectorAll("canvas");
    expect(canvases.length).toBe(2);
  });

  it("includes a file upload input", () => {
    const { container } = render(<KMeansImageCompression />);
    const fileInput = container.querySelector("input[type='file']");
    expect(fileInput).toBeTruthy();
  });
});
