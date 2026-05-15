/**
 * vectorField — pure brain of <VectorFieldPlot> (#54).
 *
 * `computeArrows` samples a vector field on a regular grid and returns
 * `Arrow[]` ready to draw. Each arrow carries:
 *   - sample position (x, y) in domain coordinates
 *   - normalized draw vector (dx, dy) — capped to ~1 cell width so density
 *     stays readable rather than visually noisy
 *   - raw magnitude (for colour mapping via <ColorBar>)
 *   - clipped magnitude (after `maxMagnitude` is applied, useful for charge
 *     fields and other singularities)
 *
 * NaN / infinite samples are coerced to zero-magnitude arrows so the
 * downstream renderer never has to special-case them.
 */

export type FieldFn = (x: number, y: number) => readonly [number, number];

export interface Arrow {
  /** Sample position x in domain coordinates. */
  readonly x: number;
  /** Sample position y in domain coordinates. */
  readonly y: number;
  /** Normalized draw delta x (≤ 1 cell width). */
  readonly dx: number;
  /** Normalized draw delta y (≤ 1 cell width). */
  readonly dy: number;
  /** Raw vector magnitude before clipping. */
  readonly magnitude: number;
  /** Magnitude after `maxMagnitude` clipping. */
  readonly magnitudeClipped: number;
}

export interface ComputeArrowsOptions {
  readonly xDomain: readonly [number, number];
  readonly yDomain: readonly [number, number];
  readonly gridSize: number;
  readonly fieldFn: FieldFn;
  /** Cap on raw magnitude. Default: Infinity (no clipping). */
  readonly maxMagnitude?: number;
  /**
   * Fraction of cell-width to use as the maximum drawn arrow length.
   * Default 0.9 (so arrows almost-but-not-quite touch their neighbours).
   */
  readonly arrowLengthFraction?: number;
}

const DEFAULT_ARROW_LENGTH_FRACTION = 0.9;

export function computeArrows(opts: ComputeArrowsOptions): Arrow[] {
  if (opts.gridSize < 1) {
    throw new RangeError("computeArrows: gridSize must be ≥ 1.");
  }

  const xDomain = normalizeDomain(opts.xDomain);
  const yDomain = normalizeDomain(opts.yDomain);
  const gridSize = Math.floor(opts.gridSize);
  const cap = opts.maxMagnitude ?? Number.POSITIVE_INFINITY;
  const lengthFraction = opts.arrowLengthFraction ?? DEFAULT_ARROW_LENGTH_FRACTION;

  const xCellWidth = (xDomain[1] - xDomain[0]) / gridSize;
  const yCellHeight = (yDomain[1] - yDomain[0]) / gridSize;
  const cellSize = Math.min(xCellWidth, yCellHeight);
  const maxDrawLength = cellSize * lengthFraction;

  const arrows: Arrow[] = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const x = xDomain[0] + (col + 0.5) * xCellWidth;
      const y = yDomain[0] + (row + 0.5) * yCellHeight;
      arrows.push(buildArrow(x, y, opts.fieldFn, cap, maxDrawLength));
    }
  }
  return arrows;
}

function buildArrow(
  x: number,
  y: number,
  fieldFn: FieldFn,
  cap: number,
  maxDrawLength: number,
): Arrow {
  const [vxRaw, vyRaw] = fieldFn(x, y);
  const vx = Number.isFinite(vxRaw) ? vxRaw : 0;
  const vy = Number.isFinite(vyRaw) ? vyRaw : 0;
  const magnitude = Math.hypot(vx, vy);

  if (magnitude === 0) {
    return { x, y, dx: 0, dy: 0, magnitude: 0, magnitudeClipped: 0 };
  }

  const clippedMagnitude = Math.min(magnitude, cap);
  // Two policies:
  //   - With a finite cap: scale linearly with magnitude/cap.
  //   - Without a cap: every arrow draws at unit length (preserves direction
  //     only). Magnitude is still captured separately for colour mapping.
  const drawScale = Number.isFinite(cap)
    ? (clippedMagnitude / cap) * maxDrawLength
    : maxDrawLength;
  return {
    x,
    y,
    dx: (vx / magnitude) * drawScale,
    dy: (vy / magnitude) * drawScale,
    magnitude,
    magnitudeClipped: clippedMagnitude,
  };
}

function normalizeDomain(
  domain: readonly [number, number],
): readonly [number, number] {
  return domain[0] <= domain[1] ? domain : [domain[1], domain[0]];
}
