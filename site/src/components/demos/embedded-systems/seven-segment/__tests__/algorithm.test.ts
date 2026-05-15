import { describe, expect, it } from "vitest";

import {
  decodeHex,
  decodeNibble,
  decodeString,
  isRepresentable,
  patternToString,
  segmentCount,
} from "../algorithm";

describe("decodeHex", () => {
  it("'8' lights all 7 segments", () => {
    expect(decodeHex("8")).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it("'1' lights only b and c", () => {
    expect(decodeHex("1")).toEqual([0, 1, 1, 0, 0, 0, 0]);
  });

  it("'0' lights everything except g", () => {
    const p = decodeHex("0");
    expect(p[6]).toBe(0); // segment g off
    expect(segmentCount(p)).toBe(6);
  });

  it("hex digits A and F use the standard letter shapes", () => {
    // A: a, b, c, e, f, g lit (no d)
    const A = decodeHex("A");
    expect(A[3]).toBe(0); // d off
    expect(segmentCount(A)).toBe(6);
    // F: a, e, f, g lit
    expect(decodeHex("F")).toEqual([1, 0, 0, 0, 1, 1, 1]);
  });

  it("uppercase A and lowercase a give the same pattern", () => {
    expect(decodeHex("a")).toEqual(decodeHex("A"));
  });

  it("' ' (space) is the blank pattern", () => {
    expect(decodeHex(" ")).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("RangeError on multi-character or unrepresentable input", () => {
    expect(() => decodeHex("")).toThrow(RangeError);
    expect(() => decodeHex("AA")).toThrow(RangeError);
    expect(() => decodeHex("Z")).toThrow(RangeError);
  });
});

describe("decodeNibble", () => {
  it("0 ⇒ '0' pattern", () => {
    expect(decodeNibble(0)).toEqual(decodeHex("0"));
  });

  it("15 ⇒ 'F' pattern", () => {
    expect(decodeNibble(15)).toEqual(decodeHex("F"));
  });

  it("RangeError on out-of-range input", () => {
    expect(() => decodeNibble(-1)).toThrow(RangeError);
    expect(() => decodeNibble(16)).toThrow(RangeError);
    expect(() => decodeNibble(1.5)).toThrow(RangeError);
  });
});

describe("isRepresentable", () => {
  it("true for hex digits and space", () => {
    for (const ch of "0123456789AbCdEF ") {
      expect(isRepresentable(ch)).toBe(true);
    }
  });

  it("false for unsupported characters", () => {
    expect(isRepresentable("Z")).toBe(false);
    expect(isRepresentable("AB")).toBe(false);
    expect(isRepresentable("")).toBe(false);
  });
});

describe("decodeString", () => {
  it("returns one pattern per character", () => {
    const r = decodeString("F00d");
    expect(r.length).toBe(4);
    expect(r[0]).toEqual(decodeHex("F"));
    expect(r[1]).toEqual(decodeHex("0"));
    expect(r[2]).toEqual(decodeHex("0"));
    expect(r[3]).toEqual(decodeHex("d"));
  });

  it("propagates RangeError on unrepresentable characters", () => {
    expect(() => decodeString("F0Z")).toThrow(RangeError);
  });

  it("empty string returns empty array", () => {
    expect(decodeString("")).toEqual([]);
  });
});

describe("patternToString", () => {
  it("renders the digit '8' with all segments visible", () => {
    const lines = patternToString(decodeHex("8")).split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]!.includes("_")).toBe(true);
    expect(lines[1]!.includes("|")).toBe(true);
    expect(lines[2]!.includes("|")).toBe(true);
  });

  it("renders blank for the space pattern (no _ or |)", () => {
    const text = patternToString(decodeHex(" "));
    expect(text.includes("_")).toBe(false);
    expect(text.includes("|")).toBe(false);
  });
});
