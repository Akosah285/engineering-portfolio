import { describe, expect, it } from "vitest";
import { decodeFrame, frameTransaction } from "../algorithm";

describe("frameTransaction", () => {
  it("emits START first and STOP last", () => {
    const f = frameTransaction({ address: 0x50, read: false, data: [0xab] });
    expect(f.events[0]!.label).toBe("START");
    expect(f.events[f.events.length - 1]!.label).toBe("STOP");
  });

  it("event count: 1 START + 8 addr + 1 ack + (8+1)·N data + 1 STOP", () => {
    const f = frameTransaction({ address: 0x50, read: false, data: [0xab, 0xcd] });
    expect(f.events.length).toBe(1 + 8 + 1 + 2 * 9 + 1);
  });

  it("ackCount = 1 (addr) + N (one per data byte)", () => {
    const f = frameTransaction({ address: 0x50, read: false, data: [0xab, 0xcd, 0xef] });
    expect(f.ackCount).toBe(4);
    expect(f.byteCount).toBe(3);
  });

  it("read=true sets LSB of address byte = 1", () => {
    const f = frameTransaction({ address: 0x50, read: true, data: [] });
    // events[8] is bit 0 of address byte
    expect(f.events[8]!.sda).toBe(1);
  });

  it("write=false sets LSB = 0", () => {
    const f = frameTransaction({ address: 0x50, read: false, data: [] });
    expect(f.events[8]!.sda).toBe(0);
  });

  it("RangeError on address > 127", () => {
    expect(() => frameTransaction({ address: 128, read: false, data: [] })).toThrow(
      RangeError,
    );
  });

  it("RangeError on data byte > 255", () => {
    expect(() => frameTransaction({ address: 0x50, read: false, data: [256] })).toThrow(
      RangeError,
    );
  });

  it("RangeError on non-integer address", () => {
    expect(() => frameTransaction({ address: 0.5, read: false, data: [] })).toThrow(
      RangeError,
    );
  });
});

describe("decodeFrame round-trip", () => {
  it("encodes then decodes same address/read/data", () => {
    const original = { address: 0x42, read: false, data: [0x01, 0x80, 0xff] };
    const enc = frameTransaction(original);
    const dec = decodeFrame(enc.events);
    expect(dec.address).toBe(0x42);
    expect(dec.read).toBe(false);
    expect(dec.data).toEqual(original.data);
    expect(dec.ackCount).toBe(enc.ackCount);
  });

  it("read=true round-trips", () => {
    const enc = frameTransaction({ address: 0x68, read: true, data: [] });
    const dec = decodeFrame(enc.events);
    expect(dec.address).toBe(0x68);
    expect(dec.read).toBe(true);
    expect(dec.data).toEqual([]);
  });

  it("RangeError on frame too short", () => {
    expect(() => decodeFrame([{ label: "X", sda: 0, scl: 1 }])).toThrow(RangeError);
  });

  it("RangeError on missing START", () => {
    const enc = frameTransaction({ address: 0x50, read: false, data: [] });
    const mutated = [{ ...enc.events[0]!, label: "X" }, ...enc.events.slice(1)];
    expect(() => decodeFrame(mutated)).toThrow(RangeError);
  });
});
