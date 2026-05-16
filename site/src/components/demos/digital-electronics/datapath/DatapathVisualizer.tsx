import { useMemo } from "react";
import { PresetCarousel } from "../../../demo-kit/PresetCarousel";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type CpuState, type Op, type RegName, initState, step } from "./algorithm";
import {
  DEFAULT_STATE,
  PRESETS,
  PROGRAMS,
  PROGRAM_SLUGS,
  type ProgramSlug,
  formatOp,
} from "./presets";
import "./DatapathVisualizer.css";

/**
 * <DatapathVisualizer> — single-step a tiny 4-register CPU through one of
 * four pre-canned programs. Wraps `./algorithm.ts` (pure ALU model) with
 * the standard demo-kit shell (PresetCarousel + SliderRow + useDemoState).
 */

const STATE_SCHEMA = {
  pc: { type: "number", default: DEFAULT_STATE.pc },
  program: { type: "enum", default: DEFAULT_STATE.program, values: PROGRAM_SLUGS },
} as const satisfies Schema;

const REG_NAMES: readonly RegName[] = ["R0", "R1", "R2", "R3"];

function bin8(n: number): string {
  return (n & 0xff).toString(2).padStart(8, "0");
}

function writtenRegister(op: Op): RegName {
  return op.rd;
}

/** Run the first `pc` ops of `program`, returning the resulting CPU state. */
function runUpTo(program: readonly Op[], pc: number): CpuState {
  let s = initState();
  for (let i = 0; i < pc && i < program.length; i += 1) {
    s = step(s, program[i]!);
  }
  return s;
}

export default function DatapathVisualizer() {
  const [state, setState, { reset }] = useDemoState(
    "datapath",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const program = PROGRAMS[state.program as ProgramSlug];
  const ops = program.ops;
  const pcMax = ops.length;
  const pc = Math.max(0, Math.min(pcMax, state.pc));

  const cpu = useMemo(() => runUpTo(ops, pc), [ops, pc]);

  const lastWritten: RegName | null = pc > 0 ? writtenRegister(ops[pc - 1]!) : null;

  const handlePresetSelect = (next: typeof state): void => {
    setState({ ...next, pc: 0 });
  };

  const handleStep = (): void => {
    setState({ ...state, pc: Math.min(pcMax, pc + 1) });
  };

  const handleReset = (): void => {
    reset();
  };

  const programIndex = Math.max(0, PROGRAM_SLUGS.indexOf(state.program as ProgramSlug));

  return (
    <div className="dp-visualizer">
      <PresetCarousel
        presets={PRESETS as unknown as { name: string; state: typeof state }[]}
        onSelect={handlePresetSelect as (next: typeof state) => void}
        ariaLabel="Datapath programs"
      />

      <div className="dp-visualizer__hud" aria-live="polite">
        {program.label} · pc={pc} of {pcMax}
      </div>

      <div className="dp-visualizer__panels">
        <div className="dp-visualizer__panel">
          <p className="dp-visualizer__panel-title">Register file</p>
          <div className="dp-visualizer__regs">
            {REG_NAMES.map((name) => {
              const isWritten = lastWritten === name;
              const value = cpu.regs[name];
              return (
                <div
                  key={name}
                  className={
                    isWritten
                      ? "dp-visualizer__reg dp-visualizer__reg--written"
                      : "dp-visualizer__reg"
                  }
                >
                  <div className="dp-visualizer__reg-name">{name}</div>
                  <div className="dp-visualizer__reg-dec">{value}</div>
                  <div className="dp-visualizer__reg-bin">{bin8(value)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dp-visualizer__panel">
          <p className="dp-visualizer__panel-title">Program</p>
          <ul className="dp-visualizer__program">
            {ops.map((op, i) => {
              const isCurrent = i === pc;
              const isDone = i < pc;
              const cls = isCurrent
                ? "dp-visualizer__line dp-visualizer__line--current"
                : isDone
                  ? "dp-visualizer__line dp-visualizer__line--done"
                  : "dp-visualizer__line";
              const marker = isCurrent ? "▸ " : isDone ? "✓ " : "  ";
              return (
                <li key={i} className={cls}>
                  {marker}
                  {formatOp(op)}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="dp-visualizer__panel">
          <p className="dp-visualizer__panel-title">Flags</p>
          <div className="dp-visualizer__flags">
            <span
              className={
                cpu.flags.zero
                  ? "dp-visualizer__flag dp-visualizer__flag--on"
                  : "dp-visualizer__flag"
              }
            >
              Z
            </span>
            <span
              className={
                cpu.flags.negative
                  ? "dp-visualizer__flag dp-visualizer__flag--on"
                  : "dp-visualizer__flag"
              }
            >
              N
            </span>
            <span
              className={
                cpu.flags.carry
                  ? "dp-visualizer__flag dp-visualizer__flag--on"
                  : "dp-visualizer__flag"
              }
            >
              C
            </span>
          </div>
        </div>
      </div>

      <div className="dp-visualizer__controls">
        <SliderRow
          label="PC (program counter)"
          min={0}
          max={pcMax}
          step={1}
          value={pc}
          onChange={(next) => setState({ ...state, pc: next })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Program"
          description={program.label}
          min={0}
          max={Math.max(0, PROGRAM_SLUGS.length - 1)}
          step={1}
          value={programIndex}
          onChange={(idx) => {
            const slug =
              PROGRAM_SLUGS[Math.max(0, Math.min(PROGRAM_SLUGS.length - 1, idx))]!;
            setState({ pc: 0, program: slug });
          }}
          format={{ precision: 0 }}
        />
      </div>

      <div className="dp-visualizer__actions">
        <button
          type="button"
          className="dp-visualizer__btn dp-visualizer__btn--primary"
          onClick={handleStep}
        >
          ↻ Step
        </button>
        <button
          type="button"
          className="dp-visualizer__btn"
          aria-label="Reset datapath"
          onClick={handleReset}
        >
          ↺ Reset
        </button>
        <span className="dp-visualizer__counter" aria-live="off">
          R0={cpu.regs.R0} · R1={cpu.regs.R1} · R2={cpu.regs.R2} · R3={cpu.regs.R3}
        </span>
      </div>
    </div>
  );
}
