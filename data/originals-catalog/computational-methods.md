# Computational Methods — originals catalog

**Course:** MATH 56 (Dartmouth, SP20). The only non-ENGS course in the portfolio,
cross-listed with COSC. Coursework follows the standard numerical-analysis arc:
floating-point + truncation error → root-finding → linear systems (direct and
iterative) → least squares → interpolation → optimisation → ill-posed inverse
problems (SVD / Tikhonov).

**Source artefacts:** 9 PDFs in `archive/originals/computational-methods/`,
gitignored per CONTENT-LICENSE.md §7.10. Most submissions are MATLAB
`publish`-exported notebooks with figures + code; a few are pen-and-paper
problem sets. This catalog paraphrases the work in my own voice; instructor-
prepared problem statements are not reproduced verbatim.

## Themes

- **Loss of significance and centered differences.** HW1 sweeps step sizes
  $h$ for the centered-difference estimator $f'(x) \approx (f(x+h) -
  f(x-h)) / (2h)$ and identifies the U-shaped error curve: truncation
  error dominates for large $h$, round-off error dominates for small $h$,
  with the minimum near $h \sim \varepsilon_{\mathrm{mach}}^{1/3}$.
- **Root-finding: bisection and Newton.** HW2 compares bisection
  (guaranteed linear convergence, requires sign change) with Newton
  (quadratic convergence near simple roots, requires derivative,
  sensitive to bad initial guesses) on a quartic with multiple real
  roots.
- **Iterative linear solvers.** HW3 puts Steepest Descent, Gauss-Seidel,
  and Conjugate Gradient head-to-head on a $3 \times 3$ SPD matrix.
  Conjugate Gradient converges in exactly 3 iterations (the
  Krylov-subspace theory bound $\le n$), Gauss-Seidel takes ~6, Steepest
  Descent ~16 because of the residual zig-zag along the long axis of the
  contour ellipses. **This is the featured-problem candidate.**
- **Gradient descent + line search.** HW4–5 implement
  `my_gradient(x,y)` for the Beale or Rosenbrock surface, then drive
  gradient descent with backtracking line search; the demo
  `GradientDescentVisualizer` on `/courses/machine-learning/` shares
  the same underlying loop.
- **Least squares + truncated SVD.** HW7 constructs the normal-equations
  estimator $\hat x = (A^T A)^{-1} A^T b$ for an over-determined system,
  then deals with the ill-posed case by truncating the SVD at the elbow
  of the singular-value plot.
- **Tikhonov regularisation for image deblurring (HW6).** Apply a known
  blur kernel to a test image, add Gaussian noise, then deblur using
  Tikhonov-regularised inverse $A^T A + \lambda I$ with $\lambda$
  swept across several decades. Without regularisation the
  reconstruction explodes from amplified high-frequency noise.

## PDFs

| Filename | Pages | Notes |
|---|---:|---|
| `MATH56HW1-merged-edited.pdf` | 13 | HW1: centered differences, error vs $h$ curves, machine-epsilon scaling. |
| `Math56HW2(1)-merged.pdf` | 10 | HW2: bisection vs Newton on $\tfrac12 x^4 - 2.7 x^2 - 2x + \tfrac12$; convergence-rate tables. |
| `Homework3M56-merged.pdf` | 12 | HW3 typed (MATLAB published): Steepest Descent / Gauss-Seidel / CG comparison on $3 \times 3$ SPD system. |
| `Homework3M56.pdf` | 11 | HW3 handwritten companion (derivation of CG residual / step-size formulas). |
| `HW4Code.pdf` | 5 | HW4 MATLAB code only (gradient descent driver, backtracking line search). |
| `HW4part1-merged.pdf` | 9 | HW4 prose + plots (handwritten scan). |
| `MATH 56 HW 5-merged.pdf` | 11 | HW5: includes `my_gradient(x,y)` function for surface-following demo. |
| `MATH 56 HW6.pdf` | 10 | HW6 (scan only): Tikhonov-regularised deblurring. |
| `MATH56HW7_Akosah.pdf` | 5 | HW7: least squares, truncated SVD elbow heuristic. |

## Featured-problem candidates (already in `computational-methods.mdx`)

1. **Newton's method, quadratic convergence near a simple root** —
   $|e_{n+1}| \le \tfrac{|f''(x^\star)|}{2|f'(x^\star)|}\,e_n^2$.
   Demonstrates why bisection's linear $|e_{n+1}| = \tfrac12 e_n$ is
   sometimes still preferred (no derivative, guaranteed bracket).
2. **RK4 local truncation error is $O(h^5)$, global $O(h^4)$** — the
   $\tfrac16 (k_1 + 2k_2 + 2k_3 + k_4)$ weighting collapses fourth-order
   Taylor terms. Ties to the `LorenzVisualizer` demo.

## Additional candidates worth surfacing in interview

- **Conjugate Gradient ≤ $n$ iterations on $n \times n$ SPD systems
  (HW3).** The Krylov-subspace argument: each CG iterate minimises the
  $A$-energy norm over a strictly enlarging Krylov subspace; after $n$
  steps the subspace exhausts $\mathbb R^n$. Verified empirically by the
  3-iteration exact-solve on the assigned $3 \times 3$ system.
- **Centered-difference round-off floor (HW1).** Total error
  $\approx \tfrac{h^2}{6} |f'''(\xi)| + \tfrac{\varepsilon_{\mathrm{mach}}}{h}$
  minimised at $h \approx (3\varepsilon_{\mathrm{mach}}/|f'''|)^{1/3}$,
  giving the famous "epsilon-cube-root" sweet spot.
- **Tikhonov $\lambda$-sweep "L-curve" for image deblurring (HW6).** Plot
  $\|x_\lambda\|$ vs $\|Ax_\lambda - b\|$ in log-log; the corner of the
  L is the sweet spot between fidelity and regularisation.
- **SVD truncation as the projection onto the dominant invariant
  subspace (HW7).** Throw away the singular values past the elbow;
  pseudo-inverse becomes $V_k \Sigma_k^{-1} U_k^T$. This is also
  exactly what the K-Means image compression demo does conceptually
  (low-rank reconstruction of pixel matrices).
