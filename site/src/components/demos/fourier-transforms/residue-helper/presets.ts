import { type Complex, add, c, div, mul } from "./algorithm";

export type FuncSlug =
  | "one-over-z"
  | "one-over-z-squared-plus-one"
  | "one-over-z-times-z-minus-2"
  | "exp-over-z";

export interface FuncSpec {
  slug: FuncSlug;
  /** Chip label; matches the regex required by tests. */
  displayName: string;
  /** The function being integrated. */
  f: (z: Complex) => Complex;
  /** Known simple-pole locations. */
  poles: readonly Complex[];
}

const ONE: Complex = { re: 1, im: 0 };

function cExp(z: Complex): Complex {
  const r = Math.exp(z.re);
  return { re: r * Math.cos(z.im), im: r * Math.sin(z.im) };
}

export const FUNCS: readonly FuncSpec[] = [
  {
    slug: "one-over-z",
    displayName: "1/z",
    f: (z) => div(ONE, z),
    poles: [c(0, 0)],
  },
  {
    slug: "one-over-z-squared-plus-one",
    displayName: "z squared plus 1",
    f: (z) => div(ONE, add(mul(z, z), ONE)),
    poles: [c(0, 1), c(0, -1)],
  },
  {
    slug: "one-over-z-times-z-minus-2",
    displayName: "1 over z times z-2",
    f: (z) => div(ONE, mul(z, { re: z.re - 2, im: z.im })),
    poles: [c(0, 0), c(2, 0)],
  },
  {
    slug: "exp-over-z",
    displayName: "exp z over z",
    f: (z) => div(cExp(z), z),
    poles: [c(0, 0)],
  },
] as const;

export const FUNC_SLUGS = FUNCS.map((f) => f.slug) as readonly FuncSlug[];

export function getFunc(slug: FuncSlug): FuncSpec {
  const found = FUNCS.find((f) => f.slug === slug);
  if (!found) throw new Error(`unknown func: ${slug}`);
  return found;
}

export const DEFAULT_FUNC: FuncSlug = "one-over-z";
export const DEFAULT_RADIUS = 1.5;
