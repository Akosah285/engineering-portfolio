import { useEffect, useMemo, useRef, useState } from "react";
import { DemoNarration } from "../../../demo-kit/DemoNarration";
import { MathHud } from "../../../demo-kit/MathHud";
import { SliderRow } from "../../../demo-kit/SliderRow";
import { type Schema, useDemoState } from "../../../demo-kit/useDemoState";
import { type RGB, kMeans } from "./algorithm";
import "./KMeansImageCompression.css";
import { SAMPLE_IMAGES, type SampleImage, getSampleImage } from "./sampleImages";

/**
 * <KMeansImageCompression> — v1 ML demo #3 (plan §4.1, #26).
 *
 * Side-by-side original vs. K-means-quantised image. Visitor picks one of
 * the bundled procedurally-generated samples (or uploads their own) and
 * slides K from 2 to 32. The cluster palette + compression-ratio readout
 * communicate the trade-off.
 */

const SAMPLE_IDS = SAMPLE_IMAGES.map((img) => img.id) as readonly string[];
const DEFAULT_SAMPLE = SAMPLE_IDS[0]!;

interface KMeansDemoState {
  k: number;
  seed: number;
  sample: string;
}

const DEFAULT_STATE: KMeansDemoState = {
  k: 4,
  seed: 7,
  sample: DEFAULT_SAMPLE,
};

const STATE_SCHEMA = {
  k: { type: "number", default: DEFAULT_STATE.k },
  seed: { type: "number", default: DEFAULT_STATE.seed },
  sample: {
    type: "enum",
    default: DEFAULT_STATE.sample,
    values: SAMPLE_IDS,
  },
} as const satisfies Schema;

const narrationTemplate = (s: KMeansDemoState): string => {
  const img = getSampleImage(s.sample);
  const name = img?.name ?? "uploaded image";
  return `K-means image compression of "${name}" with K = ${Math.round(s.k)} clusters. The right pane re-renders every pixel in its assigned cluster's mean colour, so larger K yields a higher-fidelity (but less compressed) approximation.`;
};

/** Paint an RGB-pixel array onto a canvas at native resolution. */
function paintPixels(
  canvas: HTMLCanvasElement,
  pixels: readonly RGB[],
  width: number,
  height: number,
): void {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i]!;
    const o = i * 4;
    img.data[o] = p[0];
    img.data[o + 1] = p[1];
    img.data[o + 2] = p[2];
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Compute uncompressed (24-bit) and palette-encoded (cluster-index +
 * palette) byte sizes. The palette encoding is what makes K-means useful
 * for image compression: each pixel becomes log₂(K) bits + a small palette
 * lookup table.
 */
function compressionStats(
  numPixels: number,
  k: number,
): { uncompressed: number; compressed: number; ratio: number } {
  const uncompressed = numPixels * 3; // 3 bytes per pixel
  const bitsPerIdx = Math.max(1, Math.ceil(Math.log2(k)));
  const compressed = Math.ceil((numPixels * bitsPerIdx) / 8) + k * 3;
  return { uncompressed, compressed, ratio: uncompressed / compressed };
}

export function KMeansImageCompression() {
  const [state, setState, { reset }] = useDemoState(
    "k-means-compression",
    STATE_SCHEMA,
    DEFAULT_STATE,
  );

  const [uploaded, setUploaded] = useState<SampleImage | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compressedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const sourceImage = useMemo<SampleImage | null>(() => {
    if (uploaded) return uploaded;
    return getSampleImage(state.sample) ?? SAMPLE_IMAGES[0] ?? null;
  }, [state.sample, uploaded]);

  const k = Math.max(2, Math.min(32, Math.round(state.k)));

  const result = useMemo(() => {
    if (!sourceImage) return null;
    return kMeans(sourceImage.pixels, {
      k,
      seed: Math.round(state.seed),
      maxIter: 30,
    });
  }, [sourceImage, k, state.seed]);

  // Paint original
  useEffect(() => {
    if (!sourceImage || !originalCanvasRef.current) return;
    paintPixels(
      originalCanvasRef.current,
      sourceImage.pixels,
      sourceImage.width,
      sourceImage.height,
    );
  }, [sourceImage]);

  // Paint compressed (every pixel → its centroid colour)
  useEffect(() => {
    if (!sourceImage || !result || !compressedCanvasRef.current) return;
    const out: RGB[] = result.assignments.map(
      (a) => result.centroids[a] ?? ([0, 0, 0] as RGB),
    );
    paintPixels(compressedCanvasRef.current, out, sourceImage.width, sourceImage.height);
  }, [sourceImage, result]);

  const handleFile = async (file: File): Promise<void> => {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImageFromUrl(url);
      // Downsample to a max of 128×128 to keep k-means responsive
      const max = 128;
      const ratio = Math.min(max / img.width, max / img.height, 1);
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const ctx = tmp.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const pixels: RGB[] = [];
      for (let i = 0; i < data.data.length; i += 4) {
        pixels.push([data.data[i]!, data.data[i + 1]!, data.data[i + 2]!]);
      }
      setUploaded({
        id: "uploaded",
        name: file.name,
        description: "Uploaded image",
        width: w,
        height: h,
        pixels,
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const stats = sourceImage ? compressionStats(sourceImage.pixels.length, k) : null;

  return (
    <div className="kmeans-demo">
      <div className="kmeans-demo__sample-row" role="group" aria-label="Sample images">
        {SAMPLE_IMAGES.map((img) => (
          <button
            key={img.id}
            type="button"
            className="kmeans-demo__sample-chip"
            aria-pressed={!uploaded && state.sample === img.id}
            onClick={() => {
              setUploaded(null);
              setState({ ...state, sample: img.id });
            }}
            title={img.description}
          >
            {img.name}
          </button>
        ))}
        <label className="kmeans-demo__upload-label">
          or upload:{" "}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
        </label>
      </div>

      <div className="kmeans-demo__images">
        <div className="kmeans-demo__pane">
          <h4>Original</h4>
          <canvas ref={originalCanvasRef} aria-label="Original source image" />
        </div>
        <div className="kmeans-demo__pane">
          <h4>K-means quantised (K = {k})</h4>
          <canvas
            ref={compressedCanvasRef}
            aria-label={`K-means quantised image with K = ${k} clusters`}
          />
          <MathHud
            corner="top-right"
            lines={[
              `K = ${k}`,
              `\\text{inertia} = ${result ? result.inertia.toExponential(2) : "—"}`,
            ]}
          />
        </div>
      </div>

      {sourceImage && (
        <div className="kmeans-demo__palette" aria-label="Cluster palette">
          {result?.centroids.map((c, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: palette swatches keyed by stable cluster index
              key={i}
              className="kmeans-demo__swatch"
              style={{ background: `rgb(${c[0]}, ${c[1]}, ${c[2]})` }}
              title={`Cluster ${i}: rgb(${c[0]}, ${c[1]}, ${c[2]})`}
            />
          ))}
        </div>
      )}

      <DemoNarration state={state} template={narrationTemplate} />

      <div>
        <SliderRow
          label="Number of clusters K"
          description="Each pixel maps to its cluster's mean colour. Smaller K = more compression, less fidelity."
          min={2}
          max={32}
          step={1}
          value={state.k}
          onChange={(k2) => setState({ ...state, k: k2 })}
          format={{ precision: 0 }}
        />
        <SliderRow
          label="Seed"
          description="Changes k-means++ initialisation; same seed = identical run."
          min={1}
          max={100}
          step={1}
          value={state.seed}
          onChange={(seed) => setState({ ...state, seed })}
          format={{ precision: 0 }}
        />
      </div>

      {stats && (
        <div className="kmeans-demo__readout" aria-live="polite">
          <span>Pixels: {sourceImage?.pixels.length.toLocaleString() ?? 0}</span>
          <span>Iterations: {result?.iterations ?? 0}</span>
          <span>
            Compression: {stats.compressed.toLocaleString()} B vs.{" "}
            {stats.uncompressed.toLocaleString()} B ({stats.ratio.toFixed(1)}× smaller)
          </span>
          <button
            type="button"
            className="kmeans-demo__sample-chip"
            onClick={() => {
              reset();
              setUploaded(null);
            }}
          >
            ↺ Reset
          </button>
        </div>
      )}
    </div>
  );
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}
