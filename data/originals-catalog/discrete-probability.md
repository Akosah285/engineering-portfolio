# Discrete & Probabilistic Systems — originals catalog

**Course:** ENGS 27 (Dartmouth, FA19). My first ENGS course — taken sophomore
fall, before I owned a typed-cover-page habit. As a result, **every PDF in this
course is a scan or KIC scanner output with no embedded text.** The PDF text-
extraction pass returned ≈1 KB total across the 10 PDFs (just OCR garbage from
edge artefacts). Themes below are inferred from the assignment filename
patterns + my recollection; per-PDF descriptions will be refined when these
pages go through `ocr-vault add` in v2.

**Source artefacts:** 10 PDFs in `archive/originals/discrete-probability/`,
gitignored per CONTENT-LICENSE.md §7.10. Page-1 PNG previews are in
`tmp/ocr-previews/discrete-probability/*-p1.png`. Detailed theme attribution
per PDF requires a vision pass on those previews.

## Themes (inferred from the standard ENGS 27 syllabus)

- **Counting and combinatorics.** Permutations, combinations, the
  inclusion-exclusion principle; pigeonhole arguments; multinomial
  coefficients. Standard "how many ways to..." enumerations.
- **Discrete probability spaces.** Sample spaces, events, Kolmogorov
  axioms; uniform vs non-uniform probability mass functions; conditional
  probability and the law of total probability.
- **Independence and Bayes' theorem.** False-positive / false-negative
  reasoning; the base-rate fallacy worked through diagnostic-test
  examples; Bayesian updating across a sequence of evidence.
- **Random variables and distributions.** Bernoulli, binomial, Poisson,
  geometric, hypergeometric on the discrete side; expectation, variance,
  covariance; linearity of expectation including the indicator-variable
  trick.
- **Generating functions and recurrences.** Probability generating
  functions; moment generating functions; solving linear recurrences
  via characteristic equations; Fibonacci closed form.
- **Markov chains.** Transition matrices on finite state spaces;
  classification of states (recurrent / transient); stationary
  distribution as left eigenvector of $P$ at eigenvalue 1; absorbing-
  state hitting times via fundamental-matrix identity
  $N = (I - Q)^{-1}$.
- **Random walks and gambler's ruin.** Symmetric and biased walks on
  $\mathbb Z$; absorbing barriers $\{0, N\}$; ruin probability
  closed-form $\frac{1 - (q/p)^k}{1 - (q/p)^N}$.
- **Erdős-Rényi random graphs $G(n,p)$.** Threshold phenomena for
  connectivity and giant-component emergence near $p \sim \log n / n$.
- **Discrete Markov-chain Monte Carlo intuition.** Detailed-balance
  motivation for stationary distribution sampling.
- **Hypothesis testing fundamentals.** Type-I vs Type-II error, test
  statistics, the role of significance level — set up for the
  continuous-stats course that follows (ML & Stats).

## PDFs

| Filename | Pages | Notes (pending vision pass) |
|---|---:|---|
| `ENGS27_HW1_Akwasi_Akosah.pdf` | 6 | HW1 — likely counting / basic probability. |
| `KIC Document 0001 (1).pdf` | 6 | HW2 (scanner default name). |
| `KIC Document 0001 (3).pdf` | 10 | HW3. |
| `KIC Document 0001 (4).pdf` | 12 | HW4 — heftiest middle-of-term assignment, likely Markov-chain or random-walk. |
| `KIC Document 0001 (5).pdf` | 10 | HW5. |
| `KIC Document 0001 (6).pdf` | 11 | HW6. |
| `KIC Document 0001 (7).pdf` | 11 | HW7 — typically generating functions in ENGS 27. |
| `Hw8 0001.pdf` | 8 | HW8 (alternate scanner naming). |
| `ENGS27ASSIGN8.pdf` | 9 | Assignment 8 typed cover (one of the two HW8 attempts; some embedded text recovered). |
| `SKM_658e19092320290.pdf` | 6 | SKM scanner output — likely the final problem set or quiz. |

## Featured-problem candidates (already in `discrete-probability.mdx`)

1. **Stationary distribution as left eigenvector** —
   $\pi P = \pi$ with $\sum_i \pi_i = 1$ for an irreducible aperiodic
   chain. Connects to the `MarkovChainVisualizer` demo, where users
   watch any initial distribution converge to $\pi$ under repeated
   application of $P$.
2. **Base-rate fallacy via Bayes' theorem** — disease-testing example
   where a 99 %-accurate test on a 1-in-10 000 prevalence disease still
   gives only a ~1 % positive predictive value. Ties to the
   `BayesTheoremInteractive` demo.

## Additional candidates worth surfacing in interview

- **Gambler's ruin closed form.** Biased random walk, ruin probability,
  expected duration. The `GamblersRuinSimulator` demo runs the Monte
  Carlo; the analytic recurrence solution is the math counterpart.
- **Coupon-collector expected time $nH_n$.** Indicator-variable +
  linearity-of-expectation derivation; the $H_n \approx \ln n + \gamma$
  asymptotic gives the practical "you need ≈ $n \ln n$ draws".
- **Indicator-variable trick for $\mathrm E[X^2]$ in random-graph edge
  counts.** Standard ENGS 27 problem demonstrating the power of
  $X = \sum_i \mathbf 1_{A_i}$ even when the indicators are dependent.
- **Strong Law of Large Numbers + Central Limit Theorem intuition.**
  Frequentist convergence vs Gaussian fluctuation; ties to
  `CentralLimitTheoremDemonstrator` and `MonteCarloPi` demos.
- **PageRank as a Markov chain on web graphs.** Damping factor turning
  the random surfer into an irreducible aperiodic chain; ties to the
  `PageRankToy` demo.

## Catalog-extraction caveat

Because every page is a scan, the per-PDF theme assignments above are
provisional. The v2 OCR batch run (issue #43) will land structured JSON
sidecars from which this table can be re-authored with high confidence.
The themes list itself is grounded in the course's published syllabus
and my own recollection — both stable.
