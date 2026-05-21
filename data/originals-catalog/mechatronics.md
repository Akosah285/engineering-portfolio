# Mechatronics — originals catalog

**Course:** ENGS 147 (Dartmouth, SP21). Senior-year control-systems +
mechatronics course taught with a heavy lab component. Sequence: DC motor
modelling → PID compensator design → digital control (ZOH, root locus in
discrete-time) → state-space + Bode-plot tools → micromouse maze-solving
final project. Lab progression mirrors the assignments: identify the plant
in Lab 1, design a compensator in Labs 2–4, integrate everything into the
micromouse for the final.

**Source artefacts:** 20 PDFs in `archive/originals/mechatronics/`,
gitignored per CONTENT-LICENSE.md §7.10. Most are typed (Google Docs
exports + MATLAB-published HTML PDFs); a few `-1` suffixed files are duplicate
versions where I re-saved after a small fix. This catalog paraphrases in my own
voice; instructor-prepared problem statements are not reproduced verbatim.

## Themes

- **DC motor first-order model.** Transfer function from input voltage
  $V_a$ to motor speed $\omega$ is approximately $G(s) = K /
  (\tau s + 1)$, where $K$ is the steady-state gain and $\tau$ the
  electromechanical time constant. HW2 + Lab 1 identify $K$ and $\tau$
  from step-response measurements at $V_{in} = 24\,\mathrm V$ and
  $12\,\mathrm V$.
- **Compensator design in continuous time.** Lead compensator for
  phase-margin shaping; lag compensator for low-frequency-gain
  enhancement; lead-lag for both. HW4 introduces the MATLAB
  workflow (`tf`, `feedback`, `rlocus`, `bode`).
- **Discrete-time control.** Zero-order-hold equivalent
  $G_{ZOH}(z) = (1 - z^{-1})\,\mathcal Z\{G(s)/s\}$; root locus
  drawn in the $z$-plane; stability boundary is the unit circle, not
  the imaginary axis. Lab 3 + HW6 explored ZOH discretisation at
  $T_s = 0.1\,\mathrm s$.
- **PI position control on a DC motor.** Lab 4 + HW7 tuned a PI
  compensator until the closed-loop step response hit a target
  settling time without overshoot. Steady-state error to a step
  reference goes to zero because of the integrator.
- **Sensors: encoder + IMU + accelerometer.** Assignment 8 picked
  full-scale ranges and resolution for an LSM303-style accelerometer
  ($\pm 2g$, $\pm 4g$); HW1 from the final-project arc covered
  encoder counts → wheel angle → robot pose.
- **Micromouse final project — autonomous maze solver.** Group of
  four (Akwasi + 3 teammates). System partitioned into low-level
  functions (drive_straight, turn_an_angle, wall_follow,
  position_low_level) and high-level functions (maze_navigation,
  decision_making). Low-level layer abstracts away the sensor noise
  + motor-friction asymmetry so the high-level layer can reason in
  clean grid-cell coordinates.
- **Project planning + group dynamics.** Project Proposal PDF lays
  out the function split, milestone schedule, and "who owns what" —
  the kind of artefact that gets undervalued in retrospect but
  saves weeks of integration confusion.

## PDFs

| Filename | Pages | Notes |
|---|---:|---|
| `E147_HW1_Akosah_A_v3.pdf` | 8 | HW1 (third revision): encoder kinematics, pose update from counts. |
| `E147_HW2_Akosah-merged.pdf` | 17 | HW2: DC motor plots at $V_{in} = 24\,\mathrm V$ and $12\,\mathrm V$; step-response identification. |
| `HW5-merged.pdf` | 8 | HW5: reference-input block diagram, closed-loop transfer function manipulation. |
| `Web Browser - E147_HW4.pdf` | 7 | HW4: MATLAB compensator-design script (`close all; ...`); root locus + Bode plots. |
| `Web Browser - E147_HW4_2.pdf` | 7 | HW4 alternate save. |
| `ENGS147_HW7-merged.pdf` | 9 | HW7: Lab 4 pre-lab — Motor Position Control PI design. |
| `Scanned Documents-merged.pdf` | 8 | HW6 (digital control): open-loop transfer function, root locus with ZOH at $T = 0.1$. |
| `Scanned Documents.pdf` | 4 | HW6 partial scan. |
| `Assignment 8.pdf` | 1 | Assignment 8: accelerometer FS range = $\pm 2g$. |
| `Assignment 8-1.pdf` | 1 | Assignment 8 revision: re-picked FS range = $\pm 4g$. |
| `ENGS 147 Assignment 10.pdf` | 2 | Assignment 10 (group): maze-state decision logic outline. |
| `ENGS 147 Mechatronics Lab 1 Akwasi-merged.pdf` | 16 | Lab 1: motor model identification, $K$ + $\tau$ extraction. |
| `ENGS147_Mechatronics_Akosah_LAB-merged.pdf` | 16 | Lab 1 alternate naming. |
| `Post Lab 3 Analysis-merged.pdf` | 15 | Lab 3 post-lab: PI compensator design rationale, steady-state error analysis. |
| `input volt.pdf` | 4 | Lab data scan — input-voltage step traces. |
| `E147_maze_navigation_low_level-merged.pdf` | 6 | Project: low-level maze navigation functions write-up (Group 3: Akwasi, Eric Chen, Pierre Desvallons, Carolina Lago Pena Maia). |
| `Project Planning.pdf` | 7 | Project proposal: low-level / high-level function partition. |
| `Project Planning-1.pdf` | 7 | Project proposal revision. |
| `Engs 147 Final Report - Google Docs.pdf` | 9 | Final report: autonomous micromouse maze solver — best-documented single artefact. |
| `E147_Quiz2_Akosah_A.pdf` | 6 | Quiz 2 (scan only). |

## Featured-problem candidates (already in `mechatronics.mdx`)

1. **PI pole placement on a first-order plant.** Plant $G(s) = K /
   (\tau s + 1)$ with controller $C(s) = K_p + K_i/s$. Closed-loop
   characteristic polynomial $\tau s^2 + (1 + K K_p) s + K K_i$ has
   two specifiable poles → set them to $-\omega_n$ each (critically
   damped) by choosing $K_p = (2\tau \omega_n - 1)/K$ and $K_i = \tau
   \omega_n^2 / K$. Ties to the `PIDStepResponseSim` demo.
2. **Bode-plot gain crossover and phase margin.** Define gain
   crossover $\omega_c$ as the frequency where $|G(j\omega_c)| = 1$
   (0 dB on the Bode plot); phase margin $\phi_m = 180° + \arg
   G(j\omega_c)$. Closed-loop stability needs $\phi_m > 0$;
   robustness needs $\phi_m \gtrsim 45°$. Ties to the `BodePlotBuilder`
   demo.

## Additional candidates worth surfacing in interview

- **DC motor electromechanical time constant identification (HW2 +
  Lab 1).** Fit $v(t) = v_\infty (1 - e^{-t/\tau})$ to the
  step-response trace, read $\tau$ off the 63 %-rise point. Combined
  with the steady-state speed and supply voltage, recover $K$ and
  $\tau$ in one shot.
- **ZOH discretisation gotcha at $T_s = 0.1\,\mathrm s$ (HW6).** The
  ZOH-equivalent of a continuous-time pole at $-a$ lands at $z =
  e^{-aT_s}$ — close to 1 for slow poles, which is why discretisation
  pushes roots toward the unit-circle boundary. Practical impact:
  raising sample time without re-tuning destabilises the loop.
- **Micromouse low-level function abstraction (Final Project).**
  Reason: writing `drive_straight(distance)` once with PI control
  + wall-following correction means the high-level
  `maze_navigation()` can use grid-cell semantics without thinking
  about motor friction asymmetry. The interface-design decision
  saved the team during integration.
- **Encoder-quadrature direction sensing (HW1).** A and B channels
  90° out of phase let you reconstruct rotation direction from the
  XOR + edge sequence; pure pulse-count from one channel only gives
  magnitude.
- **Accelerometer full-scale selection trade-off (Assignment 8).**
  $\pm 2g$ doubles resolution but clips on a sharp impact;
  $\pm 4g$ halves resolution but stays in-range. Picked $\pm 4g$
  after seeing the micromouse's collision spikes during early
  testing.
