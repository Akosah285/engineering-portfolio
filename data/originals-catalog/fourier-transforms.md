# Fourier Transforms & Complex Variables — originals catalog

**Course:** ENGS 92 (Dartmouth, FA20). Textbook organisation suggests Brigham
or similar; numbering throughout the homeworks follows the standard Fourier-
series → DFT → Fourier-transform → sampling theorem → complex-variables
progression. Final segment pivots into complex analysis (Cauchy-Schwarz,
analytic continuation, conformal mapping, branch cuts).

**Source artefacts:** 17 PDFs in `archive/originals/fourier-transforms/`,
gitignored per CONTENT-LICENSE.md. This catalog paraphrases the work in my
own voice; instructor-prepared problem statements are not reproduced
verbatim.

## Themes

- **Vector spaces and inner products.** Verifying which signal collections
  form vector spaces (non-negative signals, one-sided signals, strings with
  fixed ends, zero-average signals); norms (1-norm, 2-norm, ∞-norm) over
  complex vectors; orthonormality of the complex-exponential basis on
  $[-T,T]$; Cauchy-Schwarz via area comparison.
- **DFT and aliasing.** Sample sequences $f[n] = \cos(2\pi v_0 x)$ at
  various $N$, $V_s$, $V$ combinations; predicted mirror peaks at bin
  $N-m$; Hermitian symmetry $F[N-m] = F^*[m]$ and what it implies for real
  signals; energy spectrum on a real audio recording.
- **Fourier series of periodic shapes.** Triangle wave (sum of shifted
  triangle pulses), square wave, and the "third-harmonic-zero" amplitude-
  modulation trick that selects a duty cycle making $c_3 = 0$.
- **Fourier transform operational rules.** Repeated drill on the shift,
  dilation, derivative, convolution, and modulation theorems applied to
  rect, sinc, triangle, and Gaussian. Includes the classic derivation of
  the Gaussian FT pair $e^{-\pi c x^2} \leftrightarrow \frac{1}{\sqrt c}
  e^{-\pi v^2 / c}$ via the polar-coordinates trick.
- **Sampling and reconstruction.** Sinc-interpolation orthogonality
  $\langle \mathrm{sinc}\,2B(t - n/2B), \mathrm{sinc}\,2B(t - m/2B)\rangle
  = 0$ via Parseval; self-imaging functions $h(t) = e^{i\pi t^2/a}$;
  pinhole-camera/digital-sensor modelling (pixel as rect, sensor array as
  rect-windowed comb, photo as $F(v) \cdot \Delta x\,\mathrm{sinc}(\Delta
  x\,v)$ convolved with comb).
- **Half-wave rectifier and AM communications.** AM signal
  $q(t) = [1 + m\,x(t)]\cos(2\pi v_c t)$ multiplied by half-wave rectifier
  $f(t) \cdot \mathrm{rect}(2 v_c t) \cdot \text{comb}$; image spectra
  spacing $2 v_c$; low-pass demodulation.
- **Reflection seismology / deconvolution.** Two-layer geophone model
  $y(t) = \alpha w(t-t_1) + \beta w(t-t_2)$ with reflection coefficients
  $R_1, R_2, T_1$; expressed as convolution with deltas; deconvolution
  recovers source wavelet.
- **Complex variables.** Möbius transform $w = (1-z)/(1+z)$ along the
  imaginary axis (mapped to unit circle); branch cuts of $\sqrt z$
  approached from $z = x \pm i\epsilon$ and $z = \pm 1 + iy$; principal-
  angle wrapping `modifyAngle()` lifting $[-\pi, \pi]$ to $[0, 2\pi]$.
- **Noise-equivalent bandwidth.** Sweep of NEB$(n) = \pi a / (n \sin(\pi /
  (2n)))$ for varying filter order $n$.

## PDFs

| Filename | Pages | Notes |
|---|---:|---|
| `E92_PS1_Akwasi_A.pdf` | 14 | HW1 (same as `E92_Akwasi_A-merged (1).pdf`): vector spaces, inner products, norms, complex exponential orthonormality, Cauchy-Schwarz. |
| `E92_Akwasi_A-merged (1).pdf` | 16 | HW1 with MATLAB code (norm + inner product MATLAB exports). |
| `E92_HW2_Akosah_A.pdf` | 18 | DFT, aliasing predictions for various $(V, V_s, N)$, Hermitian symmetry, real-audio energy spectrum. |
| `E92_HW3_Akosah_A-merged.pdf` | 13 | Fourier series of triangle wave via shift theorem on two shifted triangles; sinc² envelope. |
| `E92_HW4_Akosah_A-merged.pdf` | 18 | Operational rules drill: shift/dilation/derivative on rect, Gaussian, triangle. Includes derivation of Gaussian FT pair. |
| `E92_HW5_Akosah_A.pdf` | 9 | Convolution theorem (Gaussian ∗ Gaussian = wider Gaussian; sinc ∗ sinc = sinc); delta-sifting integrals; cosine times rect → sum of sincs. |
| `E92_HW6_Akosah_A.pdf` | 10 | Self-imaging, AM half-wave rectifier, sample-and-hold aperture effect, digital camera (sensor array as rect-windowed comb), reflection seismology deconvolution. |
| `E92_Quiz3_Akosah_A.pdf` | 4 | Periodic signal coefficients from samples; cosine sum to Fourier coefficients; phase-shift via shift theorem; derivative theorem to recover Fourier coefficients. |
| `E92_Akwasi_DryRun.pdf` | 1 | Quick scratch on integration-by-parts trick for $\int f(t)\,e^{-st}\,dt$. |
| `FOURIER TRANSFORMS-merged.pdf` | 23 | HW7 (complex variables): Möbius $w=(1-z)/(1+z)$, $\sqrt z$ branch cuts, modified-angle function $[-\pi,\pi]\to[0,2\pi]$. |
| `FOURIER-merged.pdf` | 16 | HW8: noise-equivalent bandwidth sweep over filter order $n$ for two amplitude scales. |
| `E92_Final_Akosah_A.pdf` | 25 | Final exam: convolution algebra, Fourier-series of periodicised pulse, IFFT of `cos(2πv₀x - π/4)`, Gaussian product integral attempt (one sub-part hit a MATLAB symbolic-vs-double error). |
| `E092_Final_Exam_Akosah_A.pdf` | 25 | Same final, alternate naming. |
| `ENGS 092.pdf` | 8 | Handwritten only — likely an early problem set or quiz, pre-typed-cover era. |
| `ENGS 092-1.pdf` | 8 | Handwritten only. |
| `ENGS 092-2.pdf` | 8 | Handwritten only. |
| `domain and.pdf` | 9 | Handwritten only — title implies "domain and codomain" (complex-variables territory). |

## Featured-problem candidates (already in `fourier-transforms.mdx`)

1. **Gibbs phenomenon at jump discontinuities** — partial-sum overshoot
   ≈ 8.95 % independent of truncation order $N$; ties to the on-page
   `FourierSeriesBuilder` demo where the user can crank $N$ and watch the
   overshoot stay put.
2. **Contour integration of $\hat f(v) = \int_{-\infty}^{\infty}
   e^{-|t|}\,e^{-i2\pi vt}\,dt = \frac{2}{1 + (2\pi v)^2}$** — Cauchy
   residue theorem in the upper / lower half-plane; ties to
   `FTOfSignalsVisualizer` showing the Lorentzian.

## Additional candidates worth surfacing in interview

- **Self-imaging functions (`E92_HW6` Q1):** prove $f * h = f$ when
  $h(t) = e^{i\pi t^2/a}$ and $f(t) = \sum_n \delta(t - n x_0)$ with
  $x_0^2 = a$. Beautiful "phase + comb = identity" result.
- **Reflection seismology deconvolution (`E92_HW6` Q5):** two-layer
  geophone model expressed as convolution with deltas; pedagogically the
  same idea as the convolution-animation demo.
- **AM half-wave rectifier spectrum (`E92_HW6` Q2):** product with
  rectified carrier produces image spectra at $n \cdot 2v_c$; explains
  envelope detection in the audio-filter demo.
- **Sinc orthogonality via Parseval (`E92_HW4` Q4):** orthogonality of
  shifted sincs is the Nyquist reconstruction lemma in disguise.
- **Möbius transform on the imaginary axis (`HW7` Q1):** $w = (1-iy) /
  (1+iy)$ traces the unit circle as $y \in \mathbb R$; the conformal-
  mapping demo's hero result.
