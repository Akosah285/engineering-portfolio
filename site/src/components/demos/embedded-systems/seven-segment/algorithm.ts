// Seven-segment display decoder for the v10 Embedded Systems demo
// (#129).  Maps hex nibbles 0..F to seven-segment patterns and provides
// helpers to render arbitrary text where representable.
//
// Segment naming (standard):
//
//        a
//       ---
//    f |   | b
//       -g-
//    e |   | c
//       ---
//        d
//
// Active-high convention: 1 = segment lit.  The output bit order is
// [a, b, c, d, e, f, g].

export type Segment = "a" | "b" | "c" | "d" | "e" | "f" | "g";
export type SevenSegmentPattern = readonly [number, number, number, number, number, number, number];

const HEX_DIGITS: Record<string, SevenSegmentPattern> = {
  "0": [1, 1, 1, 1, 1, 1, 0],
  "1": [0, 1, 1, 0, 0, 0, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "3": [1, 1, 1, 1, 0, 0, 1],
  "4": [0, 1, 1, 0, 0, 1, 1],
  "5": [1, 0, 1, 1, 0, 1, 1],
  "6": [1, 0, 1, 1, 1, 1, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
  A: [1, 1, 1, 0, 1, 1, 1],
  b: [0, 0, 1, 1, 1, 1, 1],
  C: [1, 0, 0, 1, 1, 1, 0],
  d: [0, 1, 1, 1, 1, 0, 1],
  E: [1, 0, 0, 1, 1, 1, 1],
  F: [1, 0, 0, 0, 1, 1, 1],
};

const ALL_OFF: SevenSegmentPattern = [0, 0, 0, 0, 0, 0, 0];

/** Decode a single hex character to its 7-segment pattern. */
export function decodeHex(ch: string): SevenSegmentPattern {
  if (typeof ch !== "string" || ch.length !== 1) {
    throw new RangeError("decodeHex: ch must be a single character.");
  }
  if (ch === " ") return ALL_OFF;
  const upper = ch.toUpperCase();
  // Allow A..F upper, b/d lowercase as standard in datasheets.
  const key = HEX_DIGITS[upper] ? upper : HEX_DIGITS[ch] ? ch : null;
  if (key === null) throw new RangeError(`decodeHex: '${ch}' is not a representable hex digit.`);
  return HEX_DIGITS[key]!;
}

/** True iff the character can be rendered on a 7-segment display. */
export function isRepresentable(ch: string): boolean {
  if (ch.length !== 1) return false;
  if (ch === " ") return true;
  const upper = ch.toUpperCase();
  return HEX_DIGITS[upper] !== undefined || HEX_DIGITS[ch] !== undefined;
}

/** Decode a string into a sequence of patterns, blank-spaces preserved. */
export function decodeString(s: string): SevenSegmentPattern[] {
  const out = new Array<SevenSegmentPattern>(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = decodeHex(s[i]!);
  return out;
}

/** Encode a 4-bit nibble (0..15) as a 7-seg pattern. */
export function decodeNibble(n: number): SevenSegmentPattern {
  if (!Number.isInteger(n) || n < 0 || n > 15) {
    throw new RangeError("decodeNibble: n must be an integer in [0, 15].");
  }
  const ch = "0123456789AbCdEF"[n]!;
  return decodeHex(ch);
}

/** Count how many segments are lit in a pattern. */
export function segmentCount(pattern: SevenSegmentPattern): number {
  let n = 0;
  for (const v of pattern) n += v;
  return n;
}

/** Pretty-print a single pattern for debugging / tests. */
export function patternToString(pattern: SevenSegmentPattern): string {
  const [a, b, c, d, e, f, g] = pattern;
  const top = ` ${a ? "_" : " "} `;
  const mid = `${f ? "|" : " "}${g ? "_" : " "}${b ? "|" : " "}`;
  const bot = `${e ? "|" : " "}${d ? "_" : " "}${c ? "|" : " "}`;
  return `${top}\n${mid}\n${bot}`;
}
