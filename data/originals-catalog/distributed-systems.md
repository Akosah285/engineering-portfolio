# Distributed Systems & Fields — originals catalog

**Course:** ENGS 23 (Dartmouth, WI20). "Distributed systems" here is the
**continuum-mechanics / field-theory** sense, not the computer-systems one —
the term covers transmission lines, the 1D wave equation, the diffusion
equation, Laplace / Poisson on bounded regions, and Maxwell-derived
electrostatics + magnetostatics, all unified by Fourier series + separation
of variables.

**Source artefacts:** 20 PDFs in `archive/originals/distributed-systems/`,
gitignored per CONTENT-LICENSE.md §7.10. The course had labs (transmission
line, wave equation, potential plotting) and a group project on Fourier
series + diffusion + waves. Many PDFs are KIC scanner output of handwritten
problem sets; the group project + lab reports are typed. This catalog
paraphrases in my own voice; instructor-prepared problem statements are not
reproduced verbatim.

## Themes

- **First-order systems.** RC charging $\tau = RC$, RL switching
  $\tau = L/R$, time-constant fitting from the experimentally
  measured $v(t) = V_\infty (1 - e^{-t/\tau})$ trace.
- **Second-order systems.** Series RLC: under-damped (oscillatory
  decay), over-damped (slow exponential return), critically damped
  (fastest non-oscillatory return); damping ratio $\zeta = R/2
  \sqrt{C/L}$. Lab 2 set $R = 39\,\Omega$ for underdamped, $R = 61\,
  \Omega$ for critical, $R = 124\,\Omega$ for overdamped on the
  given $L$, $C$.
- **Transmission lines.** Velocity $v = 1 / \sqrt{LC}$, characteristic
  impedance $Z_0 = \sqrt{L/C}$, reflection coefficient
  $\Gamma = (Z_L - Z_0) / (Z_L + Z_0)$ at a load. Lab 2 used coax
  to verify reflection on open/short terminations.
- **Fourier series on bounded intervals.** Square wave + triangle
  wave expansions; Gibbs phenomenon; convergence rates depending on
  the smoothness of the function.
- **1D wave equation $u_{tt} = c^2 u_{xx}$.** d'Alembert solution
  $u(x,t) = f(x - ct) + g(x + ct)$ for an infinite string; separation
  of variables on $[0, L]$ with fixed ends gives standing waves with
  frequencies $f_n = nc/(2L)$. Lab 3 verified this on a vibrating
  string.
- **1D diffusion / heat equation $u_t = \alpha u_{xx}$.** Separation
  of variables gives $u(x,t) = \sum_n B_n \sin(n\pi x/L)\,e^{-\alpha
  (n\pi/L)^2 t}$; the $n^2$ factor in the decay rate is why
  high-frequency Fourier modes wash out first.
- **Laplace / Poisson in 2D.** Lab 4 plotted equipotential and
  electric-field lines for a configuration of magnets (used as a
  proxy for an electrostatics problem); the `lab4_potential_plot(x1,
  y1, direction)` MATLAB function evaluates the scalar potential at
  a query point.
- **Biot-Savart and Ampere's law.** Magnetic field of current loops
  and infinite wires; symmetry-argument Ampere applications
  (solenoid, toroid, coaxial cable).
- **Faraday induction.** $\mathcal E = -\frac{d\Phi_B}{dt}$ applied
  to a coil moving through a uniform $B$-field, and to a coil in a
  time-varying $B$-field.
- **Group project — Fourier series, diffusion, waves (Feb 16, 2020).**
  53-page report tying the three together: Fourier-decompose an
  initial condition, propagate each mode under either the heat or
  wave evolution operator, recombine for the time-dependent solution.

## PDFs

| Filename | Pages | Notes |
|---|---:|---|
| `ENGS23HW1.pdf` | 17 | HW1: RC + RL transients, time-constant identification. |
| `engs23 hw1 3c and d.pdf` | 1 | HW1 problem 3 standalone — $\tau$ from $R = 2060\,\Omega$, $C = 330\,\mu$F. |
| `KIC Document 114-merged.pdf` | 16 | HW1 or HW2 scan (KIC scanner default name). |
| `Merged_File.pdf` | 16 | Same scan, alternate name (identical leading content). |
| `E23_PS2_3d&e-merged.pdf` | 9 | PS2 parts 3d/3e: RLC damping cases — $R = 39 / 61 / 124\,\Omega$. |
| `KIC Document 142-merged.pdf` | 11 | PS2 full scan. |
| `KIC Document 151-merged.pdf` | 16 | HW3 scan — Coulomb force + electric-field problems. |
| `KIC Document 151-merged (2).pdf` | 16 | HW3 scan duplicate. |
| `E23_HW3-merged.pdf` | 18 | HW3 typed cover + scan: prop loop derivatives, transmission-line setup. |
| `E23_PS3-merged.pdf` | 18 | PS3 scan duplicate. |
| `Download File.pdf` | 35 | HW4 typed: MATLAB code for problem 1b. |
| `E23_PS4-merged.pdf` | 35 | PS4 scan + MATLAB. |
| `KIC Document 174-merged.pdf` | 22 | PS5 scan (Laplace / Poisson territory). |
| `KIC Document 318.pdf` | 46 | Heaviest individual PDF — likely Final or term-exam corpus. |
| `Lab2_final.pdf` | 7 | Lab 2: transmission-line lab data sheet, reflection coefficients. |
| `Electronics_Lab3.pdf` | 2 | Lab 3 short writeup — references textbook Figure 2.11. |
| `lab3 wave equation-merged.pdf` | 8 | Lab 3 full: speed of sound in a string, $f_n = nv/(2L)$. |
| `lab4_potential_plot-merged.pdf` | 14 | Lab 4: `lab4_potential_plot(x1,y1,direction)` MATLAB function + plots. |
| `ENGS_23_Group_6_Project.pdf` | 53 | Group project (Group 6): Fourier series + diffusion + waves, due Feb 16 2020. |
| `ENGS_23_Group_6_Project (12).pdf` | 54 | Group project final version (1-page longer = revision). |

## Featured-problem candidates (already in `distributed-systems.mdx`)

1. **d'Alembert solution to the 1D wave equation.** $u(x,t) =
   f(x-ct) + g(x+ct)$ uniquely determined by $u(x,0) = \phi(x)$,
   $u_t(x,0) = \psi(x)$ via $f(s) = \tfrac12 \phi(s) - \tfrac{1}{2c}
   \int_0^s \psi$, $g(s) = \tfrac12 \phi(s) + \tfrac{1}{2c} \int_0^s
   \psi$. Ties to the `WaveEqVisualizer` demo where users set initial
   shape + velocity and watch the two travelling waves.
2. **Magnetic field of a circular current loop on its axis.**
   Biot-Savart integral collapses by symmetry to $B_z(z) = \frac{\mu_0
   I R^2}{2 (R^2 + z^2)^{3/2}}$. Ties to the `BiotSavartLoopBField`
   demo where users sweep $R$ and $I$ and watch the on-axis profile.

## Additional candidates worth surfacing in interview

- **Standing waves on a fixed-end string (Lab 3).** Separation of
  variables predicts $f_n = nv/(2L)$; the lab measured $v$ from the
  observed $f_1$ and string length, and recovered the textbook string
  density.
- **Transmission-line reflection coefficient (Lab 2).** Open / short
  terminations give $\Gamma = +1, -1$; intermediate impedances give
  the measured intermediate reflection amplitudes. Hooks the
  characteristic-impedance concept into something physical.
- **Heat-equation modal decay (group project).** Each Fourier mode
  decays as $e^{-\alpha (n\pi/L)^2 t}$; the $n^2$ in the exponent
  means high-frequency details wash out first. Visually this is why
  edges blur faster than slow gradients.
- **Equipotential line plotting from `lab4_potential_plot.m`.** Pass
  in $(x_1, y_1, \text{direction})$ and integrate along the
  potential gradient — Lab 4's MATLAB function plus the
  `ChargeFieldPlotter` demo are exactly the same algorithm.
- **RLC critical damping condition $R = 2\sqrt{L/C}$.** Boundary
  between two real roots (overdamped) and a complex-conjugate pair
  (underdamped); the lab tuned $R$ across this boundary to see the
  qualitative change.
