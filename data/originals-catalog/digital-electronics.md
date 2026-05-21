# Digital Electronics — originals catalog

**Course:** ENGS 31 (Dartmouth, SP20), cross-listed with COSC 56. Foundations
of digital-circuit design done in VHDL on Basys3 FPGA boards: combinational
logic → sequential logic + FSMs → datapath / controller partitioning →
register-file memories → serial communication → capstone Morse-code
translator. The course's full vocabulary (entity, architecture, signal, port
map, std_logic_vector, generate-statements, IEEE.NUMERIC_STD) lives in the
final-project source.

**Source artefacts:** 10 PDFs in `archive/originals/digital-electronics/`,
gitignored per CONTENT-LICENSE.md §7.10. Mix of MATLAB-style cover pages,
EDA Playground waveform exports, and KIC scans of handwritten K-maps + FSM
diagrams. The hero artefact is the 100-page final-project report
(`Engs 31 Project Planning.pdf`) on a Morse-code encoder + interpreter built
in VHDL. This catalog paraphrases in my own voice; instructor-prepared
problem statements are not reproduced verbatim.

## Themes

- **Combinational logic design via case statements / K-maps.** HW2
  built a 4-bit-to-7-segment-display decoder; the standard ENGS 31
  exercise — derive the minimum SOP for each segment $\{a,b,c,d,e,f,g\}$
  from a 4-input truth table, then implement via `process(A,B,C,D)`
  and `case` in VHDL.
- **Sequential logic — flip-flops, registers, counters.** HW3 sets up
  D-flip-flop chains for an up-down counter with synchronous reset
  and clock enable. `schematic.pdf` is the symbolic version of an
  up/down counter with `up_down`, `CE`, `reset`, `minusOp_i` ports.
- **Finite-state machines (Moore + Mealy).** HW4 designed an FSM in
  VHDL with explicit state-enumerated type, `process(clk, reset)`
  state register, and `process(state, inputs)` next-state /
  output logic — the textbook two-process FSM template. Lab 3's
  stopwatch FSM was the in-class exemplar.
- **Sequence detector — 1011 (Moore vs Mealy).** Classic HW3
  problem: Moore detector needs 4 states (S0, S1, S10, S101) +
  output decoded from S101; Mealy detector folds the output into
  the transition, giving 3 states. Trade-off: Moore is glitch-free,
  Mealy is faster.
- **Datapath + controller pattern.** Every Lab + the final project
  partitions the design into a **datapath** (registers, ALU, muxes,
  arithmetic) and a **controller** (FSM that issues `shift_en`,
  `load_en`, etc.). The Morse final project has 8 datapath /
  controller pairs in its full hierarchy.
- **Serial Communications Interface (SCI) Receiver + Transmitter.**
  Final project: 9600 baud UART-style RX with start bit detection,
  internal sub-counters for half-bit + full-bit periods, double-flop
  synchroniser to avoid metastability. TX concatenates start + stop
  bits and shifts out at the same baud rate.
- **EDA Playground waveform-based verification.** HW5 used EDA
  Playground to simulate a combination lock circuit; the
  publicly-shareable URL is included in the submission. This
  pattern is captured by the `VhdlWaveform` demo on the site —
  a pre-compiled GHDL waveform of a simple counter / FSM.

## PDFs

| Filename | Pages | Notes |
|---|---:|---|
| `HW1(1).pdf` | 9 | HW1 (scan only): truth tables, basic gate identities, SOP/POS minimisation. |
| `hw2.pdf` | 10 | HW2 (scan): combinational logic — 4-bit input to 7-segment decoder, K-map per segment, VHDL implementation. |
| `Homework3.pdf` | 3 | HW3 original: sequential logic — up/down counter or 1011 sequence detector. |
| `Homework3-merged.pdf` | 4 | HW3 merged version (canonical). |
| `HW3EDA.pdf` | 0 | Corrupted PDF (PDFium data-format error); originally an EDA Playground export — likely the waveform PNG for HW3. |
| `HW4Q1_PDF-merged-edited.pdf` | 12 | HW4: FSM design in VHDL — full Design.vhd + testbench listing. |
| `HW4Q1_PDF-merged-edited (1).pdf` | 12 | HW4 alternate save. |
| `HW5ENG31-merged (1).pdf` | 5 | HW5: combination-lock annotated waveform, EDA Playground URL referenced. |
| `schematic.pdf` | 1 | One-page schematic: `clk`, `up_down`, `CE`, `reset`, `minusOp_i` ports — likely the up-down counter for HW3 or a lab. |
| `Engs 31 Project Planning.pdf` | 100 | Final project: Morse Code Translator + Interpreter in VHDL on Basys3. 8-module hierarchy: SCI Rx / SCI Tx / Enter Compare / ASCII Queue / Morse Translator / Morse Interpreter (datapath + controller) / Sound Wave Gen / Sound Gen. Group: Akwasi Akosah + Tyler Neath. |

## Featured-problem candidates (already in `digital-electronics.mdx`)

1. **K-map minimisation: 4-input → simplest SOP.** Group adjacent
   1-cells in powers of two; ungrouped 1-cells become product
   terms. Practical demo: the 7-segment decoder's segment-$a$
   output reduces from 16 minterms to a 5-product-term SOP
   covering only the digits where segment $a$ is on. Ties to the
   `KarnaughMinimizer` demo.
2. **1011 sequence detector — Moore vs Mealy.** Moore detector has
   4 states + output only in the accepting state; Mealy has 3
   states + output computed from current state + current input.
   Moore is glitch-free but one cycle slower; Mealy is faster but
   the output briefly tracks input transients. Ties to the
   `FsmStopwatchAnimation` demo and the on-page comparison
   between the two FSM topologies.

## Additional candidates worth surfacing in interview

- **Two-process FSM template in VHDL (HW4).** Standard pattern:
  one synchronous `process(clk, reset)` updates the state
  register, one combinational `process(state, inputs)` computes
  next-state + outputs via `case state is`. Why two processes:
  separates timing from logic, makes synthesis cleaner.
- **Double-flop metastability synchroniser (Final Project SCI Rx).**
  Two cascaded D-flip-flops between an asynchronous external Rx
  signal and the FSM's `sync_out`. Cuts the metastability failure
  probability by a factor of $e^{-T_r / \tau}$ per stage where
  $T_r$ is the resolution time.
- **Datapath / controller decomposition (Final Project).** Eight
  components, each with a clean port interface — the design's
  modularity is the reason the project worked under the
  inability to simulate hardware behaviour directly (the
  capstone was during remote COVID instruction). Each
  component had its own test bench; integration was the hard
  part.
- **Half-baud-period start-bit alignment (Final Project SCI Rx
  Controller).** Wait1 state engages a sub-counter that hits
  terminal count at half the baud period — aligns the
  data-sampling instant to the middle of each bit so the
  receiver decision happens away from the bit-edge transitions.
- **ASCII queue as 100 × 8 register file with full / empty
  flags (Final Project).** Read and write pointers + size
  counter; full = size == 100, empty = size == 0; asynchronous
  read returns the longest-resident byte (FIFO discipline).
