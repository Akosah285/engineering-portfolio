import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PolynomialRegression } from "../PolynomialRegression";

afterEach(() => {
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/");
  }
});

describe("<PolynomialRegression>", () => {
  it("renders sliders, regularization chips, and a canvas", () => {
    const { container, getByLabelText, getByRole } = render(<PolynomialRegression />);

    // Four sliders
    expect(getByLabelText(/Polynomial degree/i)).toBeTruthy();
    expect(getByLabelText(/Regularization λ/i)).toBeTruthy();
    expect(getByLabelText(/Noise σ/i)).toBeTruthy();
    expect(getByLabelText(/Sample size n/i)).toBeTruthy();

    // Three regularization chips
    expect(getByRole("button", { name: /OLS/i })).toBeTruthy();
    expect(getByRole("button", { name: /Ridge/i })).toBeTruthy();
    expect(getByRole("button", { name: /Lasso/i })).toBeTruthy();

    // Canvas
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();
  });

  it("renders preset chips for each preset", () => {
    const { getAllByRole } = render(<PolynomialRegression />);
    const options = getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(6);
  });
});
