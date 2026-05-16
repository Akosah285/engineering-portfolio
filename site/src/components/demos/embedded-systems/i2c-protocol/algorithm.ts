// I²C protocol bit-pattern generator + decoder.
//
// Each I²C transaction:
//   START → 7-bit address + R/W bit → ACK → [data byte → ACK] × n → STOP
//
// This module emits the sequence of SDA/SCL events that visualization can
// render, and can decode a known good bit stream back into the address +
// payload bytes for assertion.

export type BusLevel = 0 | 1;

export interface BusEvent {
  readonly label: string; // "START" | "ADDR_bit_7" | "ACK" | "DATA_byte_0_bit_3" | "STOP" | ...
  readonly sda: BusLevel;
  readonly scl: BusLevel;
}

export interface FrameInput {
  readonly address: number; // 7-bit, 0..127
  readonly read: boolean; // true = read (R/W = 1), false = write
  readonly data: readonly number[]; // each byte 0..255
}

export interface FrameResult {
  readonly events: readonly BusEvent[];
  readonly ackCount: number;
  readonly byteCount: number;
}

function validate(input: FrameInput): void {
  if (!Number.isInteger(input.address) || input.address < 0 || input.address > 0x7f) {
    throw new RangeError("address must be a 7-bit integer (0..127)");
  }
  for (const b of input.data) {
    if (!Number.isInteger(b) || b < 0 || b > 0xff) {
      throw new RangeError("data bytes must be in 0..255");
    }
  }
}

export function frameTransaction(input: FrameInput): FrameResult {
  validate(input);
  const events: BusEvent[] = [];
  // START: SDA falls while SCL is high.
  events.push({ label: "START", sda: 0, scl: 1 });
  // Address bits MSB-first.
  const addrByte = (input.address << 1) | (input.read ? 1 : 0);
  for (let i = 7; i >= 0; i -= 1) {
    const bit = ((addrByte >>> i) & 1) as BusLevel;
    events.push({ label: `ADDR_bit_${i}`, sda: bit, scl: 1 });
  }
  // ACK from slave: SDA low.
  events.push({ label: "ADDR_ACK", sda: 0, scl: 1 });
  let ackCount = 1;
  // Data bytes.
  for (let byteIdx = 0; byteIdx < input.data.length; byteIdx += 1) {
    const byte = input.data[byteIdx]!;
    for (let i = 7; i >= 0; i -= 1) {
      const bit = ((byte >>> i) & 1) as BusLevel;
      events.push({ label: `DATA_${byteIdx}_bit_${i}`, sda: bit, scl: 1 });
    }
    events.push({ label: `DATA_${byteIdx}_ACK`, sda: 0, scl: 1 });
    ackCount += 1;
  }
  // STOP: SDA rises while SCL is high.
  events.push({ label: "STOP", sda: 1, scl: 1 });
  return { events, ackCount, byteCount: input.data.length };
}

export interface DecodedFrame {
  readonly address: number;
  readonly read: boolean;
  readonly data: readonly number[];
  readonly ackCount: number;
}

// Decode a bus event stream back into a frame (or throw).
export function decodeFrame(events: readonly BusEvent[]): DecodedFrame {
  if (events.length < 11) throw new RangeError("frame too short");
  if (events[0]!.label !== "START") throw new RangeError("frame must start with START");
  if (events[events.length - 1]!.label !== "STOP") {
    throw new RangeError("frame must end with STOP");
  }
  // Address byte from events 1..8 (MSB → LSB).
  let addrByte = 0;
  for (let i = 0; i < 8; i += 1) {
    addrByte = (addrByte << 1) | events[1 + i]!.sda;
  }
  const address = addrByte >>> 1;
  const read = (addrByte & 1) === 1;
  // ACK at index 9.
  if (events[9]!.sda !== 0) throw new RangeError("missing ADDR_ACK");
  let ackCount = 1;
  // Data bytes: each is 8 bits + 1 ACK = 9 events. STOP is last.
  const data: number[] = [];
  let idx = 10;
  while (idx < events.length - 1) {
    if (idx + 9 > events.length - 1) {
      throw new RangeError("misaligned data byte");
    }
    let byte = 0;
    for (let i = 0; i < 8; i += 1) {
      byte = (byte << 1) | events[idx + i]!.sda;
    }
    data.push(byte);
    if (events[idx + 8]!.sda !== 0) throw new RangeError("missing DATA_ACK");
    ackCount += 1;
    idx += 9;
  }
  return { address, read, data, ackCount };
}
