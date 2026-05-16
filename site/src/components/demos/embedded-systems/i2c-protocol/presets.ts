import type { FrameInput } from "./algorithm";

export const TXN_SLUGS = [
  "sensor-read-1byte",
  "eeprom-write-2byte",
  "display-init",
  "empty-frame",
] as const;

export type TxnSlug = (typeof TXN_SLUGS)[number];

export interface I2cDemoState {
  cursor: number;
  transaction: TxnSlug;
}

export const DEFAULT_STATE: I2cDemoState = {
  cursor: 0,
  transaction: "sensor-read-1byte",
};

const TRANSACTION_INPUTS: Readonly<Record<TxnSlug, FrameInput>> = {
  "sensor-read-1byte": { address: 0x68, read: true, data: [0xab] },
  "eeprom-write-2byte": { address: 0x50, read: false, data: [0x10, 0x42] },
  "display-init": { address: 0x3c, read: false, data: [0xae, 0xd5, 0x80] },
  "empty-frame": { address: 0x70, read: true, data: [] },
};

export function getTransactionInput(slug: TxnSlug): FrameInput {
  return TRANSACTION_INPUTS[slug];
}

export interface I2cPreset {
  name: string;
  state: I2cDemoState;
}

export const TRANSACTIONS: readonly I2cPreset[] = [
  { name: "Sensor read 1B", state: { cursor: 0, transaction: "sensor-read-1byte" } },
  { name: "EEPROM write 2B", state: { cursor: 0, transaction: "eeprom-write-2byte" } },
  { name: "Display init", state: { cursor: 0, transaction: "display-init" } },
  { name: "Empty frame", state: { cursor: 0, transaction: "empty-frame" } },
];

export const PRESETS = TRANSACTIONS;
