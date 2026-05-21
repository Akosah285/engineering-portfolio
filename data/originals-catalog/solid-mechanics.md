# Solid Mechanics — originals catalog

**Course:** ENGS 33 (Dartmouth, FA20). Classical mechanics-of-materials sequence:
statics review → stress and strain → axial / torsion / bending → combined
loading via Mohr's circle → buckling and stability → design project (truss
bridge). Several problem sets exist in both an original and a `_REV` revision
copy — those are graded-feedback revisions, and the revision is the canonical
"final" answer.

**Source artefacts:** 26 PDFs in `archive/originals/solid-mechanics/`,
gitignored per CONTENT-LICENSE.md §7.10. About a third are MATLAB-published
notebooks (Lab 1 tensile testing); the rest are hand-solved problem sets and
the multi-week truss-bridge design project. This catalog paraphrases in my own
voice; instructor-prepared problem statements are not reproduced verbatim.

## Themes

- **Units conversion fluency.** PS1 spent serious time on slug → kg →
  lbm → kg/m³ conversions with significant-figure discipline. Boring
  but foundational — the rest of the term assumes you can convert
  without making sign or factor errors.
- **Stress, strain, and elastic moduli.** Lab 1 tensile tests on
  aluminium and copper coupons, extracted $E$ from the linear region,
  yield strength from the 0.2 %-offset method, ultimate strength from
  the peak of the engineering stress-strain curve. MATLAB-published
  notebooks render the actual data.
- **Equilibrium of trusses (method of joints + sections).** PS2–PS3
  build comfort with 2D pin-truss analysis; identify zero-force
  members; pick the analysis method that minimises algebra.
- **Axial / torsion / bending.** PS4–PS5 work through normal-stress
  formulas $\sigma = P/A$, shear-stress for circular shafts
  $\tau = T\rho / J$, bending stress $\sigma = -My/I$, and
  shear-stress distribution in beam cross-sections via
  $\tau = VQ / (I b)$.
- **Beam deflection.** PS6 integrates $EI v''(x) = M(x)$ twice with
  boundary conditions for cantilever, simply-supported, and
  fixed-fixed beams. Singularity functions (Macaulay brackets) used
  where the load distribution has discontinuities.
- **Combined loading and Mohr's circle.** PS7 takes a 2D stress state
  $(\sigma_x, \sigma_y, \tau_{xy})$ and constructs the circle in the
  $(\sigma, \tau)$ plane; principal stresses from the circle's
  extrema; maximum in-plane shear from the radius; principal angles
  from $\tan 2\theta_p = 2\tau_{xy} / (\sigma_x - \sigma_y)$.
- **Buckling of columns.** PS8 develops Euler's critical load
  $P_{cr} = \pi^2 EI / (KL)^2$ for the four standard end conditions
  ($K = 1$ pinned-pinned, $K = 0.5$ fixed-fixed, $K = 2$ free-fixed,
  $K = 0.7$ pinned-fixed); slenderness ratio $L_e / r$ to decide
  whether Euler or Johnson formula governs.
- **Truss-bridge design project (5 weeks).** Precedent research →
  pre-design model construction → concept design → Week 5 + Week 6
  iterative design with computed member forces. Final model was a
  modified Warren truss with diagonal cross-bracing for stability.

## PDFs

| Filename | Pages | Notes |
|---|---:|---|
| `E33_PS1_Akosah_A.pdf` | 14 | PS1 original: units, density, basic stress / strain definitions. |
| `E33_PS1_Revision_Akosah_A.pdf` | 14 | PS1 graded-feedback revision (canonical). |
| `E33_PS2_Akosah_A.pdf` | 11 | PS2 original: truss equilibrium, method of joints. |
| `E33_PS2_Akosah_A_REV.pdf` | 11 | PS2 revision (canonical). |
| `E33_PS_3_Akosah_A.pdf` | 10 | PS3 original: more truss analysis. |
| `E33_PS3_Akosah_A_REV.pdf` | 10 | PS3 revision (canonical). |
| `E33_PS4_Akosah_A.pdf` | 11 | PS4 original: axial + torsion. |
| `E33_PS4_Akosah_A_REV.pdf` | 11 | PS4 revision (canonical). |
| `E33_PS5_Akosah_A.pdf` | 11 | PS5 original: bending stress, $\sigma = -My/I$ application. |
| `E33_PS5_Akosah_A_REV.pdf` | 11 | PS5 revision (canonical). |
| `E33_PS6_Akosah_A.pdf` | 11 | PS6 original: beam deflection via double integration. |
| `E33_PS6_Akosah_A_REV.pdf` | 13 | PS6 revision (canonical). |
| `E33_PS7_Akosah_A.pdf` | 16 | PS7 original: Mohr's circle, principal stresses. |
| `E33_PS7_Akosah_A_REV.pdf` | 18 | PS7 revision (canonical). |
| `E33_PS8_Akosah_A_REV.pdf` | 12 | PS8 (no original retained): Euler buckling, slenderness ratio. |
| `Deflection at.pdf` | 13 | Likely PS6 standalone calc — beam deflection at a specific point. |
| `E33_Lab1_Akosah_A_plot 1-merged.pdf` | 13 | Lab 1 MATLAB-published: aluminium + copper tensile tests, stress-strain curves, $E$ extraction. |
| `E33_Concept_Design_Akosah_A.pdf` | 7 | Project: concept-design diagrams (side elevation, vertical bar, diagonal beam). |
| `E33_Pre_Design_Model_Construction.pdf` | 10 | Project: precedent analysis of a Warren-style truss, component naming, gallery research. |
| `E33_Precedent_Research_Akwasi_A.pdf` | 3 | Project: Warren truss precedent write-up. |
| `E33_ProjectWeek5_Akosah_A.pdf` | 14 | Project Week 5: front elevation + member sizing. |
| `E33_ProjectWeek6_Akwasi_A.pdf` | 8 | Project Week 6: truss analysis 1 (modified for stability). |
| `E33_ProjectWeek6_Akwasi_A-1.pdf` | 8 | Project Week 6 duplicate (same as above). |
| `Question 3 concept diagram.pdf` | 1 | One-page concept diagram for project question 3. |
| `Group_6_CAD_model.pdf` | 4 | Group CAD renderings of final bridge. |
| `ENGS 033.pdf` | 13 | Catch-all scan — likely the term-final report or quiz. |

## Featured-problem candidates (already in `solid-mechanics.mdx`)

1. **Pressure-vessel Mohr's circle.** Thin-walled cylinder with
   internal pressure $p$: hoop stress $\sigma_\theta = pr/t$, axial
   stress $\sigma_z = pr/(2t)$, no shear on the principal planes.
   Mohr's circle is centred at $\sigma_z + (\sigma_\theta -
   \sigma_z)/2 = 3pr/(4t)$ with radius $pr/(4t)$. Featured because
   the geometric "find the principal stresses by reading off the
   circle" feels much cleaner than memorising eigenvalue formulas.
2. **Euler buckling for a pinned-pinned column.** Derive
   $P_{cr} = \pi^2 EI / L^2$ from $EI v''(x) + P v(x) = 0$ with
   $v(0) = v(L) = 0$; the lowest nontrivial mode is
   $v(x) = \sin(\pi x / L)$. Ties to the `EulerBucklingCalculator`
   demo where users sweep $L$, $E$, $I$ and watch the critical load
   shift.

## Additional candidates worth surfacing in interview

- **Lab 1 tensile-test data fit (aluminium vs copper).** Extract $E$
  from the linear region; compare to handbook values; comment on the
  ductility differences in the post-yield region.
- **Beam deflection of a cantilever under tip load (PS6).**
  $v(L) = -PL^3 / (3EI)$ derived from double integration with
  $v(0) = v'(0) = 0$.
- **Truss bridge design iteration (Project Weeks 5–6).** Walk through
  why the diagonal cross-bracing was added — first-pass Warren truss
  was unstable under the prescribed load; cross-bracing turned the
  rectangular sub-panels into rigid triangles.
- **VQ/Ib shear flow in I-beams (PS5).** Shear stress concentrates at
  the neutral axis where $Q$ is maximised; explains why thin webs
  carry most of the shear.
