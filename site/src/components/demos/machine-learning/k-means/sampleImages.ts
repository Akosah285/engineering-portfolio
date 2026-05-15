/**
 * Bundled sample images for the K-Means demo. Generated procedurally so
 * we don't need to ship binary assets — keeps repo small and avoids
 * licensing questions for v1. (Visitor upload comes via a separate
 * <input type="file">, see the React component.)
 *
 * Each generator returns an { width, height, pixels: RGB[] } record where
 * `pixels` is row-major.
 */

import type { RGB } from "./algorithm";

export interface SampleImage {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  pixels: RGB[];
}

const SIZE = 128;

function generateGradient(): SampleImage {
  const pixels: RGB[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const r = Math.round((x / (SIZE - 1)) * 255);
      const g = Math.round((y / (SIZE - 1)) * 255);
      const b = Math.round(((x + y) / (2 * (SIZE - 1))) * 255);
      pixels.push([r, g, b]);
    }
  }
  return {
    id: "gradient",
    name: "Smooth gradient",
    description: "RGB sweep — clusters fall along the diagonal",
    width: SIZE,
    height: SIZE,
    pixels,
  };
}

function generateSunset(): SampleImage {
  // Painterly sunset: orange at the top, deep red horizon, dark blue water
  const pixels: RGB[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const t = y / (SIZE - 1);
      let r: number;
      let g: number;
      let b: number;
      if (t < 0.4) {
        // Sky: amber → orange
        const u = t / 0.4;
        r = Math.round(255 - u * 30);
        g = Math.round(180 - u * 80);
        b = Math.round(80 - u * 40);
      } else if (t < 0.55) {
        // Horizon glow
        r = Math.round(220 - (t - 0.4) * 200);
        g = Math.round(60 - (t - 0.4) * 200);
        b = Math.round(40 + (t - 0.4) * 120);
      } else {
        // Water: indigo → navy
        const u = (t - 0.55) / 0.45;
        r = Math.round(20 + u * 5);
        g = Math.round(20 + u * 5);
        b = Math.round(60 - u * 30);
      }
      // Subtle horizontal banding
      const wave = Math.sin((x / SIZE) * Math.PI * 4) * 8;
      r = Math.max(0, Math.min(255, Math.round(r + wave)));
      g = Math.max(0, Math.min(255, Math.round(g + wave)));
      pixels.push([r, g, b]);
    }
  }
  return {
    id: "sunset",
    name: "Sunset palette",
    description: "Three rough colour zones — sky, horizon, water",
    width: SIZE,
    height: SIZE,
    pixels,
  };
}

function generateForest(): SampleImage {
  // Deterministic pseudo-random forest canopy: greens with brown bark + sky
  const pixels: RGB[] = [];
  let state = 1234;
  const rand = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const skyT = Math.max(0, 1 - y / (SIZE * 0.35));
      const isBark = rand() < 0.05;
      const isSky = skyT > 0.5 && rand() < skyT * 0.7;
      let r: number;
      let g: number;
      let b: number;
      if (isSky) {
        r = 180 + Math.round(rand() * 30);
        g = 200 + Math.round(rand() * 30);
        b = 230 + Math.round(rand() * 25);
      } else if (isBark) {
        r = 80 + Math.round(rand() * 30);
        g = 50 + Math.round(rand() * 20);
        b = 30 + Math.round(rand() * 15);
      } else {
        // Foliage greens
        const greenIntensity = 90 + Math.round(rand() * 80);
        r = 30 + Math.round(rand() * 40);
        g = greenIntensity;
        b = 20 + Math.round(rand() * 30);
      }
      pixels.push([r, g, b]);
    }
  }
  return {
    id: "forest",
    name: "Forest canopy",
    description: "Greens, browns, and a hint of sky — needs more clusters",
    width: SIZE,
    height: SIZE,
    pixels,
  };
}

function generateCheckerboard(): SampleImage {
  // 4-color checkerboard with noise — easy to verify K=4 is exactly right
  const pixels: RGB[] = [];
  const colors: RGB[] = [
    [220, 60, 60],
    [60, 200, 80],
    [60, 80, 220],
    [240, 220, 60],
  ];
  let state = 999;
  const rand = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cell = SIZE / 4;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cx = Math.floor(x / cell) % 2;
      const cy = Math.floor(y / cell) % 2;
      const idx = cx * 2 + cy;
      const base = colors[idx]!;
      const noise = Math.round((rand() - 0.5) * 30);
      pixels.push([
        Math.max(0, Math.min(255, base[0] + noise)),
        Math.max(0, Math.min(255, base[1] + noise)),
        Math.max(0, Math.min(255, base[2] + noise)),
      ]);
    }
  }
  return {
    id: "checkerboard",
    name: "Four-color checkerboard",
    description: "K=4 is the natural fit — perfect for testing the algorithm",
    width: SIZE,
    height: SIZE,
    pixels,
  };
}

export const SAMPLE_IMAGES: ReadonlyArray<SampleImage> = [
  generateCheckerboard(),
  generateSunset(),
  generateGradient(),
  generateForest(),
];

export function getSampleImage(id: string): SampleImage | undefined {
  return SAMPLE_IMAGES.find((img) => img.id === id);
}
