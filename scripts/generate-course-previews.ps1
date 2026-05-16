# Generates site/src/components/CoursePreview/{slug}.astro for each non-ML course.
# Each file mounts every demo for the course inside <DemoChrome>, hero with
# client:idle and the rest with client:visible. Embedded in the Coming-Soon
# course-page UX so visitors can play with the demos before the written
# reflection ships.
#
# Re-run idempotently when the demo manifest changes.

$ErrorActionPreference = "Stop"

$repoRoot   = Resolve-Path "$PSScriptRoot\..\"
$siteRoot   = Join-Path $repoRoot "site"
$gallery    = Get-Content (Join-Path $siteRoot "src\pages\dev\gallery.astro") -Raw
$outDir     = Join-Path $siteRoot "src\components\CoursePreview"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Parse gallery for every (course, demo, import-expression, file) tuple.
$matches = [regex]::Matches($gallery, 'import\s+(\{?\s*\w+\s*\}?)\s+from\s+"[^"]+demos/([^/]+)/([^/]+)/(\w+)";')
$rows = foreach ($m in $matches) {
  $importExpr = $m.Groups[1].Value.Trim()
  $isNamed    = $importExpr.StartsWith("{")
  $compName   = if ($isNamed) {
    ($importExpr.Trim("{","}")).Trim()
  } else {
    $importExpr
  }
  [PSCustomObject]@{
    Course      = $m.Groups[2].Value
    DemoSlug    = $m.Groups[3].Value
    File        = $m.Groups[4].Value
    IsNamed     = $isNamed
    Component   = $compName
  }
}

# Per-course config — hero demo + human-readable titles + 1-line descriptions.
# Hero demos per plan §4.
$courseConfig = @{
  "fourier-transforms" = @{
    Display     = "Fourier Transforms & Complex Variables"
    Hero        = "epicycle"
    DemoTitles  = @{
      "audio-filter"    = @{ title = "Audio filter — Web Audio biquad"; desc = "Drag the cutoff and Q to hear how a biquad sculpts a synth or microphone signal." }
      "conformal"       = @{ title = "Conformal mapping";              desc = "Watch how an analytic map deforms a grid while preserving angles." }
      "convolution"     = @{ title = "Convolution animation";          desc = "Slide one signal past another and trace the running integral of their product." }
      "domain-coloring" = @{ title = "Complex domain coloring";        desc = "Phase-as-hue / magnitude-as-brightness visualisation of analytic functions." }
      "epicycle"        = @{ title = "Epicycle drawing animation";     desc = "Sum a chain of rotating vectors and reconstruct an arbitrary path as Fourier coefficients tune." }
      "fourier-series"  = @{ title = "Fourier series builder";         desc = "Stack sine and cosine harmonics and watch the partial sums converge to square / sawtooth / triangle." }
      "ft-signals"      = @{ title = "Fourier transform of common signals"; desc = "Side-by-side time-domain and frequency-domain plots for canonical signals." }
      "residue-helper"  = @{ title = "Residue theorem helper";         desc = "Compute residues at poles inside a contour and verify against the contour integral." }
    }
  }
  "discrete-probability" = @{
    Display     = "Discrete & Probabilistic Systems"
    Hero        = "markov-chain"
    DemoTitles  = @{
      "bayes-theorem"      = @{ title = "Bayes' theorem";                desc = "Sliders for prior, likelihood, and false-positive rate; live posterior + 2x2 table." }
      "birthday-paradox"   = @{ title = "Birthday paradox simulator";    desc = "Drag the room size and watch the collision probability climb past 50% near 23 people." }
      "central-limit"      = @{ title = "Central limit theorem";         desc = "Pick a base distribution, stack the sample means, watch a Gaussian emerge." }
      "combinatorics"      = @{ title = "Combinations & permutations";   desc = "Calculator + visual enumeration for nPk and nCk with small n." }
      "erdos-renyi"        = @{ title = "Erdős-Rényi random graph";      desc = "Tune the edge probability p and watch the giant component appear past the threshold." }
      "gamblers-ruin"      = @{ title = "Gambler's ruin / Monte Carlo";  desc = "Biased coin walks to ruin or fortune; theoretical vs simulated absorption probabilities." }
      "hypothesis-testing" = @{ title = "Hypothesis testing";            desc = "Visualise α, β, p-values and effect size for a one-sided z-test." }
      "markov-chain"       = @{ title = "Markov chain visualizer";       desc = "Drag transition probabilities, step the chain, watch the stationary distribution emerge." }
      "monte-carlo-pi"     = @{ title = "Monte Carlo π estimator";       desc = "Drop random darts into a unit square; convergence of 4·hits/total to π." }
      "page-rank"          = @{ title = "PageRank toy";                  desc = "Tiny web graph; power-iteration converges to the dominant eigenvector." }
    }
  }
  "computational-methods" = @{
    Display     = "Computational Methods"
    Hero        = "rk4-solver"
    DemoTitles  = @{
      "bisection"               = @{ title = "Bisection method";                desc = "Bracket-and-halve root finding with live convergence trace." }
      "dft"                     = @{ title = "Discrete Fourier transform";      desc = "Stem plots for a signal's DFT amplitude + phase, with windowing options." }
      "gaussian-elimination"    = @{ title = "Gaussian elimination — step by step"; desc = "Watch row operations reduce an augmented matrix to row-echelon form." }
      "lagrange-spline"         = @{ title = "Lagrange vs cubic spline";        desc = "Add interpolation nodes; compare Runge's-phenomenon-prone Lagrange to natural cubic splines." }
      "least-squares"           = @{ title = "Least squares curve fitting";     desc = "Click to drop points; fit polynomials of varying degree with sum-of-squared-residuals." }
      "lu-decomposition"        = @{ title = "LU decomposition";                desc = "Animate the LU factorisation step by step on a 4×4 matrix." }
      "monte-carlo-integration" = @{ title = "Monte Carlo integration";         desc = "Compare convergence rates of MC integration vs trapezoidal rule." }
      "newtons-method"          = @{ title = "Newton's method";                 desc = "Tangent-line iteration with quadratic-convergence visualisation." }
      "power-iteration"         = @{ title = "Eigenvalue power iteration";      desc = "Iterate Ax → x until the dominant eigenvector emerges." }
      "quadrature"              = @{ title = "Numerical integration comparator"; desc = "Side-by-side midpoint / trapezoidal / Simpson's rule error analysis." }
      "rk4-solver"              = @{ title = "Runge-Kutta ODE solver (Lorenz)"; desc = "RK4 on the Lorenz system; tune σ/ρ/β and watch the strange attractor unfold." }
    }
  }
  "solid-mechanics" = @{
    Display     = "Solid Mechanics"
    Hero        = "truss-analyzer"
    DemoTitles  = @{
      "beam-deflection"   = @{ title = "Beam deflection calculator"; desc = "Cantilever / simply-supported / fixed-fixed beams under point or distributed load." }
      "bending-stress"    = @{ title = "Bending stress distribution"; desc = "σ = My/I across a beam cross-section, with neutral-axis visualisation." }
      "euler-buckling"    = @{ title = "Euler buckling calculator";   desc = "Critical buckling load vs slenderness ratio for the four boundary cases." }
      "failure-criteria"  = @{ title = "Failure criteria explorer";   desc = "Tresca vs von Mises vs maximum-normal-stress envelopes in σ1-σ2 space." }
      "mohr-circle"       = @{ title = "Mohr's circle";              desc = "Drag the stress element; watch the Mohr's circle and principal stresses update." }
      "shear-moment"      = @{ title = "Shear & moment diagrams";    desc = "Place supports and loads; auto-derive the V and M diagrams along the beam." }
      "stress-3d"         = @{ title = "3D stress state visualizer"; desc = "Stress tensor on a unit cube; rotate to explore principal stresses." }
      "stress-strain"     = @{ title = "Stress-strain curve";        desc = "Elastic / yield / plastic / necking regions for common engineering materials." }
      "torsion"           = @{ title = "Torsion of shafts";          desc = "Shear stress and angle of twist for a circular shaft under applied torque." }
      "truss-analyzer"    = @{ title = "Interactive truss analyzer"; desc = "Build a 2D truss, apply loads, solve for member forces via method of joints." }
    }
  }
  "distributed-systems" = @{
    Display     = "Distributed Systems & Fields"
    Hero        = "charge-field"
    DemoTitles  = @{
      "biot-savart"    = @{ title = "Biot-Savart B-field";          desc = "Magnetic field from a current loop or coil, visualised as field lines and arrows." }
      "charge-field"   = @{ title = "Charge field plotter";         desc = "Drop point charges; live E-field arrows + equipotential contours." }
      "faraday"        = @{ title = "Faraday's law / induced EMF";  desc = "Slide a magnet through a coil; live flux and induced EMF traces." }
      "heat-equation"  = @{ title = "1D heat equation";             desc = "Finite-difference solver for heat diffusion along a rod; tune boundary conditions." }
      "laplace-rect"   = @{ title = "Laplace in a rectangle";       desc = "Iterative Laplace solver on a rectangular domain with mixed Dirichlet boundaries." }
      "rc-rl"          = @{ title = "RC / RL step response";        desc = "First-order circuit step + frequency response side by side." }
      "vector-field"   = @{ title = "Vector field visualizer";      desc = "Type any 2D vector field; render its arrows, divergence, and curl." }
      "wave-2d"        = @{ title = "2D wave interference";         desc = "Two-source interference pattern with adjustable phase, frequency, and separation." }
      "wave-equation"  = @{ title = "1D wave equation (string)";    desc = "Plucked-string wave equation with reflective boundary conditions." }
    }
  }
  "mechatronics" = @{
    Display     = "Mechatronics"
    Hero        = "pid-controller"
    DemoTitles  = @{
      "bode-plot"      = @{ title = "Bode plot builder";         desc = "Compose poles and zeros; live magnitude + phase Bode plots." }
      "dc-motor"       = @{ title = "DC motor model";            desc = "First-order DC motor response to a step voltage with adjustable back-EMF and inertia." }
      "maze-pathfind"  = @{ title = "Maze pathfinding";          desc = "BFS / DFS / A* search on a small grid maze with frontier visualisation." }
      "pid-controller" = @{ title = "PID step response";         desc = "Tune Kp / Ki / Kd; watch overshoot, rise time, and steady-state error change live." }
      "sensor-fusion"  = @{ title = "Sensor fusion — encoder + IMU"; desc = "Complementary filter combining wheel encoders and a noisy IMU for heading estimation." }
      "state-machine"  = @{ title = "State machine — decision_making"; desc = "Step through the robot's behaviour FSM transitions, lifted from decision_making.ino." }
      "step-position"  = @{ title = "Step position control";     desc = "Step-input position controller with closed-loop tracking visualisation." }
      "two-link-ik"    = @{ title = "2-link inverse kinematics"; desc = "Drag an end-effector target; solve joint angles for a 2-DOF planar arm." }
    }
  }
  "digital-electronics" = @{
    Display     = "Digital Electronics"
    Hero        = "fsm-simulator"
    DemoTitles  = @{
      "alu-bit-slice"      = @{ title = "ALU bit-slice explorer";      desc = "1-bit ALU slice cascaded to 4-bit; toggle operation lines and watch results propagate." }
      "binary-counter"     = @{ title = "Counter simulator";            desc = "Synchronous / ripple counters with adjustable modulus and clock visualisation." }
      "datapath"           = @{ title = "Datapath visualizer — lab4";   desc = "Animated datapath for the Lab 4 lifted directly from lab4_datapath.vhd." }
      "fsm-simulator"      = @{ title = "FSM simulator (stopwatch preset)"; desc = "Build a finite state machine, step the clock, watch transitions fire." }
      "karnaugh-minimizer" = @{ title = "Karnaugh map minimizer";       desc = "Type a Boolean expression; auto-derive the minimal SOP via K-map grouping." }
      "latch-vs-ff"        = @{ title = "Latch vs flip-flop";           desc = "Level-sensitive latch vs edge-triggered flip-flop side by side with timing diagrams." }
      "stopwatch-fsm"      = @{ title = "Stopwatch FSM animation";      desc = "Lab 3 stopwatch FSM with start / stop / reset transitions animated." }
      "truth-table"        = @{ title = "Logic gate truth table builder"; desc = "Drag-and-drop gates; auto-derive the truth table and minimal Boolean expression." }
      "vhdl-waveform"      = @{ title = "VHDL → animated waveform";     desc = "Pre-compiled VHDL test benches rendered as live waveform animations." }
    }
  }
  "embedded-systems" = @{
    Display     = "Embedded Systems"
    Hero        = "traffic-light"
    DemoTitles  = @{
      "accelerometer"     = @{ title = "Accelerometer (DeviceMotion)";    desc = "Live tilt visualisation using your phone's accelerometer (iOS gesture-unlock supported)." }
      "adc-sampling"      = @{ title = "ADC sampling / aliasing";         desc = "Tune the sample rate against the signal frequency; watch aliasing appear past Nyquist." }
      "i2c-protocol"      = @{ title = "I²C protocol visualizer";        desc = "Step through an I²C start / address / data / ack / stop transaction at the bit level." }
      "interrupt-polling" = @{ title = "Interrupt vs polling";           desc = "Two side-by-side execution timelines comparing interrupt-driven and polled event handling." }
      "mqtt"              = @{ title = "MQTT IoT message flow";          desc = "Publish / subscribe / broker animation with QoS levels and topic wildcards." }
      "pwm"               = @{ title = "PWM visualizer";                 desc = "Tune duty cycle and frequency; watch the average-voltage approximation drive a load." }
      "rpm"               = @{ title = "RPM measurement";                desc = "Reading rotational speed from encoder pulses or magnetic Hall-effect transitions." }
      "seven-segment"     = @{ title = "Seven-segment decoder";          desc = "Hex digit → segment-encoding map with a live BCD-to-seven-segment lookup." }
      "solar-tracker"     = @{ title = "Solar tracker logic";            desc = "Two-LDR comparator drives the servo toward the brighter side." }
      "traffic-light"     = @{ title = "Traffic light FSM (AIO_MQTT)";   desc = "Lifted from AIO_MQTT_traffic_control; FSM with normal / pedestrian / night modes." }
    }
  }
}

foreach ($course in $courseConfig.Keys) {
  $config       = $courseConfig[$course]
  $courseRows   = $rows | Where-Object { $_.Course -eq $course }
  $heroSlug     = $config.Hero
  $heroRow      = $courseRows | Where-Object { $_.DemoSlug -eq $heroSlug } | Select-Object -First 1
  $restRows     = $courseRows | Where-Object { $_.DemoSlug -ne $heroSlug } | Sort-Object DemoSlug

  if (-not $heroRow) {
    throw "Course $course is missing its hero demo $heroSlug"
  }

  $importLines = @()
  $importLines += "import DemoChrome from `"../demo-kit/DemoChrome.astro`";"

  $allDemos = @($heroRow) + @($restRows)
  foreach ($d in $allDemos) {
    $importExpr = if ($d.IsNamed) { "{ $($d.Component) }" } else { $d.Component }
    $importLines += "import $importExpr from `"../demos/$course/$($d.DemoSlug)/$($d.File)`";"
  }

  $heroTitleEntry = $config.DemoTitles[$heroSlug]
  $heroTitle      = $heroTitleEntry.title
  $heroDesc       = $heroTitleEntry.desc

  $sectionLines = @()
  $sectionLines += "  <DemoChrome"
  $sectionLines += "    title=`"$heroTitle`""
  $sectionLines += "    shareable={false}"
  $sectionLines += "    demoSourcePath=`"site/src/components/demos/$course/$heroSlug/$($heroRow.File).tsx`""
  $sectionLines += "  >"
  $sectionLines += "    <p class=`"preview-demos__desc`">$heroDesc</p>"
  $sectionLines += "    <$($heroRow.Component) client:idle />"
  $sectionLines += "  </DemoChrome>"

  foreach ($d in $restRows) {
    $entry = $config.DemoTitles[$d.DemoSlug]
    if (-not $entry) { throw "Missing title entry for $course / $($d.DemoSlug)" }
    $sectionLines += ""
    $sectionLines += "  <DemoChrome"
    $sectionLines += "    title=`"$($entry.title)`""
    $sectionLines += "    shareable={false}"
    $sectionLines += "    demoSourcePath=`"site/src/components/demos/$course/$($d.DemoSlug)/$($d.File).tsx`""
    $sectionLines += "  >"
    $sectionLines += "    <p class=`"preview-demos__desc`">$($entry.desc)</p>"
    $sectionLines += "    <$($d.Component) client:visible />"
    $sectionLines += "  </DemoChrome>"
  }

  $imports  = $importLines -join "`n"
  $sections = $sectionLines -join "`n"
  $count    = $courseRows.Count

  $body = @"
---
/**
 * Course demo preview — $($config.Display)
 *
 * Mounted inside the Coming-Soon variant of /courses/$course/ so visitors
 * can play with every demo built for this course before its written
 * reflection ships. Hero demo hydrates client:idle; the rest hydrate
 * client:visible to keep initial load cheap.
 *
 * Generated by scripts/generate-course-previews.ps1 — edit the manifest
 * there (not this file) when the demo list or descriptions change.
 */
$imports
---

<section class="preview-demos" aria-labelledby="preview-demos-heading-$course">
  <h2 id="preview-demos-heading-$course">Preview the demos ($count)</h2>
  <p class="preview-demos__lede">
    The interactive demos for this course are wired and playable below. The
    written reflection and featured problems land with the full course page —
    track progress on the <a
      href="https://github.com/Akosah285/engineering-portfolio/issues"
      >issue tracker</a
    >.
  </p>

$sections
</section>

<style>
  .preview-demos {
    margin: 3rem auto 0;
    max-width: 60rem;
  }
  .preview-demos > :global(* + *) {
    margin-top: 2rem;
  }
  .preview-demos__lede {
    color: var(--color-text-muted);
    margin: 0.5rem 0 2rem;
  }
  .preview-demos__desc {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
    margin: 0 0 0.75rem;
  }
</style>
"@

  $outPath = Join-Path $outDir "$course.astro"
  Set-Content -Path $outPath -Value $body -Encoding UTF8 -NoNewline
  Write-Output "wrote $outPath ($count demos, hero=$heroSlug)"
}

Write-Output ""
Write-Output "Done. Now edit site/src/pages/courses/[slug].astro to dispatch by slug."
