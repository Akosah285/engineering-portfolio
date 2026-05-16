// Complex domain coloring — visualize f: C -> C by mapping output to HSV.
// Reference: Frank Farris, "Visualizing Complex-Valued Functions" (Notices AMS,
// 1998) and Wegert, "Visual Complex Functions" (2012).
//
// Hue = arg(f(z)) / (2π), normalized to [0,1)
// Saturation = 1 (full)
// Value (lightness) = a smooth function of |f(z)|; common choice:
//   v = 0.5 + (1/π) * atan(log(|f(z)|))
// which is bounded in (0,1), monotone, and equals 0.5 when |f|=1.

export interface ComplexF {
  re: number;
  im: number;
}

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const TAU = Math.PI * 2;

export function hueFromArg(z: ComplexF): number {
  const arg = Math.atan2(z.im, z.re);
  // map [-π, π) -> [0, 1)
  let h = arg / TAU + 0.5;
  if (h >= 1) h -= 1;
  if (h < 0) h += 1;
  return h;
}

export function valueFromMagnitude(z: ComplexF): number {
  const mag = Math.hypot(z.re, z.im);
  if (mag === 0) return 0;
  return 0.5 + Math.atan(Math.log(mag)) / Math.PI;
}

export function colorAt(z: ComplexF): HSV {
  return {
    h: hueFromArg(z),
    s: 1,
    v: valueFromMagnitude(z),
  };
}

// Standard HSV -> RGB (chromatic). All channels in [0,1].
export function hsvToRgb(hsv: HSV): RGB {
  const { h, s, v } = hsv;
  if (h < 0 || h >= 1 || s < 0 || s > 1 || v < 0 || v > 1) {
    throw new RangeError("hsvToRgb: components out of range");
  }
  const c = v * s;
  const hp = h * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = v - c;
  return { r: r + m, g: g + m, b: b + m };
}

export interface GridSpec {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  width: number;
  height: number;
}

// Sample f over a rectangular grid and return per-pixel HSV.
// Pixel order: row-major, y descending (image-space y).
export function colorGrid(
  f: (z: ComplexF) => ComplexF,
  g: GridSpec,
): HSV[] {
  if (!Number.isInteger(g.width) || !Number.isInteger(g.height)) {
    throw new RangeError("colorGrid: width and height must be integers");
  }
  if (g.width <= 0 || g.height <= 0) {
    throw new RangeError("colorGrid: width and height must be positive");
  }
  if (g.xMin >= g.xMax || g.yMin >= g.yMax) {
    throw new RangeError("colorGrid: bounds must satisfy xMin<xMax, yMin<yMax");
  }
  const dx = (g.xMax - g.xMin) / (g.width - 1);
  const dy = (g.yMax - g.yMin) / (g.height - 1);
  const out: HSV[] = new Array(g.width * g.height);
  for (let j = 0; j < g.height; j++) {
    const y = g.yMax - j * dy; // top row = yMax
    for (let i = 0; i < g.width; i++) {
      const x = g.xMin + i * dx;
      const z = f({ re: x, im: y });
      out[j * g.width + i] = colorAt(z);
    }
  }
  return out;
}
