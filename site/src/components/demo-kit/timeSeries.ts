/**
 * timeSeries — pure brain of <TimeSeriesPlot> (#53).
 *
 * A small immutable ring-buffer abstraction tuned for live demos that stream
 * samples (PID step response, RC response, audio scope, sensor traces).
 *
 * Why immutable?  React's reconciler cares about reference equality. Returning
 * a fresh buffer from `pushSample` lets consumers store it in `useState` and
 * trigger a re-render naturally, without `useRef` / `forceUpdate` shenanigans.
 *
 * The on-the-wire array is *internally* mutable (we overwrite a slot in
 * place when we rotate). External callers never see that mutation because
 * `pushSample` always allocates the wrapping `RingBuffer` object.
 */

export interface Sample {
  /** Timestamp in arbitrary units (commonly seconds since demo start). */
  readonly t: number;
  readonly value: number;
}

export interface RingBuffer {
  readonly capacity: number;
  readonly size: number;
  readonly head: number;
  readonly samples: ReadonlyArray<Sample | undefined>;
}

export function createRingBuffer(capacity: number): RingBuffer {
  if (capacity <= 0 || !Number.isFinite(capacity)) {
    throw new RangeError("createRingBuffer: capacity must be > 0.");
  }
  return {
    capacity,
    size: 0,
    head: 0,
    samples: new Array<Sample | undefined>(capacity).fill(undefined),
  };
}

export function pushSample(buf: RingBuffer, sample: Sample): RingBuffer {
  const samples = buf.samples.slice();
  samples[buf.head] = sample;
  return {
    capacity: buf.capacity,
    size: Math.min(buf.size + 1, buf.capacity),
    head: (buf.head + 1) % buf.capacity,
    samples,
  };
}

/**
 * Return the samples whose timestamp falls in [now - windowSeconds, now] in
 * chronological order. Out-of-window samples (older or newer) are dropped.
 */
export function windowSlice(
  buf: RingBuffer,
  now: number,
  windowSeconds: number,
): Sample[] {
  if (buf.size === 0) return [];
  const cutoff = now - windowSeconds;
  const out: Sample[] = [];
  // Walk from oldest to newest. The oldest sample sits at `head` once the
  // buffer is full; before that, it sits at index 0.
  const start = buf.size < buf.capacity ? 0 : buf.head;
  for (let i = 0; i < buf.size; i += 1) {
    const idx = (start + i) % buf.capacity;
    const s = buf.samples[idx];
    if (!s) continue;
    if (s.t < cutoff) continue;
    if (s.t > now) continue;
    out.push(s);
  }
  return out;
}
