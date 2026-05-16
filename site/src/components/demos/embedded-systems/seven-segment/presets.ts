/**
 * Named presets for the seven-segment visualiser (#129).
 *
 * Only characters representable by HEX_DIGITS (0-9, A, b, C, d, E, F) and
 * blank spaces can be rendered, so every preset's `text` is curated to
 * stay within that alphabet.
 */

export type SevenSegmentPresetSlug =
  | "hello"
  | "count-0-7"
  | "hex-AbCdEF"
  | "year"
  | "blank";

export interface SevenSegmentDemoState {
  presetSlug: SevenSegmentPresetSlug;
  text: string;
  brightness: number;
}

export interface SevenSegmentPreset {
  name: string;
  state: SevenSegmentDemoState;
}

export const DEFAULT_STATE: SevenSegmentDemoState = {
  presetSlug: "hello",
  text: "5AFE",
  brightness: 100,
};

export const PRESETS: readonly SevenSegmentPreset[] = [
  {
    name: "Hello (5AFE)",
    state: { presetSlug: "hello", text: "5AFE", brightness: 100 },
  },
  {
    name: "Count 0-7",
    state: { presetSlug: "count-0-7", text: "01234567", brightness: 100 },
  },
  {
    name: "Hex AbCdEF",
    state: { presetSlug: "hex-AbCdEF", text: "AbCdEF", brightness: 100 },
  },
  {
    name: "Year 2024",
    state: { presetSlug: "year", text: "2024", brightness: 100 },
  },
  {
    name: "Blank",
    state: { presetSlug: "blank", text: "        ", brightness: 40 },
  },
] as const;
