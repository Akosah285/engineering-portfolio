/**
 * useDemoState — URL fragment state serialization for shareable demos.
 *
 * Pure functions (serialize/deserialize) live at the top; the React hook
 * lives at the bottom and wraps them. Pure functions are tested in
 * isolation; the hook is tested via React Testing Library.
 *
 * Fragment format: `#demo=<demo-slug>&<key>=<value>&...`
 *   - Values are URL-encoded.
 *   - Numbers serialize via Number.prototype.toString() (preserves precision
 *     within Number.MAX_SAFE_INTEGER).
 *   - Strings are URL-encoded.
 *   - Enums serialize as their string form.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type FieldType = "number" | "string" | "enum";

export type FieldSchema =
  | { type: "number"; default: number }
  | { type: "string"; default: string }
  | { type: "enum"; default: string; values: readonly string[] };

export type Schema = Record<string, FieldSchema>;

export type StateOf<S extends Schema> = {
  [K in keyof S]: S[K]["default"];
};

/**
 * Serialize a state object to a URL fragment string.
 *
 * @param state The current state values
 * @param schema The schema describing each field
 * @param demoSlug The demo identifier (becomes `demo=<slug>`)
 * @returns A URL fragment starting with `#`
 */
export function serializeState<S extends Schema>(
  state: StateOf<S>,
  schema: S,
  demoSlug: string,
): string {
  const params = new URLSearchParams();
  params.set("demo", demoSlug);
  for (const key of Object.keys(schema)) {
    const value = state[key as keyof StateOf<S>];
    params.set(key, String(value));
  }
  return `#${params.toString()}`;
}

/**
 * Parse a URL fragment back into a state object. Unknown keys are ignored.
 * Missing keys, malformed values, and out-of-range enum values fall back to
 * the schema's defaults — never throws.
 *
 * @param fragment The URL fragment (with or without leading `#`)
 * @param schema The schema describing each field
 * @returns The parsed state, with defaults filled in for missing/invalid keys
 */
export function deserializeState<S extends Schema>(
  fragment: string,
  schema: S,
): StateOf<S> {
  const stripped = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const params = new URLSearchParams(stripped);

  const result = {} as StateOf<S>;
  for (const key of Object.keys(schema)) {
    const field = schema[key];
    if (!field) continue;
    const raw = params.get(key);
    if (raw === null) {
      result[key as keyof StateOf<S>] = field.default as StateOf<S>[keyof StateOf<S>];
      continue;
    }
    if (field.type === "number") {
      const n = Number(raw);
      result[key as keyof StateOf<S>] = (Number.isFinite(n)
        ? n
        : field.default) as StateOf<S>[keyof StateOf<S>];
    } else if (field.type === "string") {
      result[key as keyof StateOf<S>] = raw as StateOf<S>[keyof StateOf<S>];
    } else if (field.type === "enum") {
      const isValid = field.values.includes(raw);
      result[key as keyof StateOf<S>] = (isValid
        ? raw
        : field.default) as StateOf<S>[keyof StateOf<S>];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// useDemoState — the React hook
// ---------------------------------------------------------------------------

export interface UseDemoStateOptions {
  /** Whether to read/write the URL fragment. Default: true. */
  shareable?: boolean;
  /** Debounce window for fragment writes, in ms. Default: 100. */
  debounceMs?: number;
}

export interface UseDemoStateControls {
  /** Returns the current full URL including the serialized fragment. */
  share: () => string;
  /** Resets state to schema defaults and clears the fragment. */
  reset: () => void;
}

export type UseDemoStateReturn<S extends Schema> = [
  StateOf<S>,
  (next: StateOf<S> | ((prev: StateOf<S>) => StateOf<S>)) => void,
  UseDemoStateControls,
];

/**
 * Hook: keeps demo state in sync with the URL fragment for shareable demos.
 *
 * On mount (browser only), parses `window.location.hash` and merges it
 * over `initialState`. Setting state writes the new fragment back to the
 * URL after a `debounceMs` window (so dragging a slider doesn't spam
 * `history.replaceState`).
 *
 * Opt out of sharing by passing `{ shareable: false }`; the hook then
 * behaves like plain `useState` with no URL interaction.
 *
 * @param demoSlug    Unique identifier for the demo (e.g., "gradient-descent")
 * @param schema      Field schema (controls deserialization)
 * @param initialState  Defaults used when fragment doesn't supply a key
 * @param options     `{ shareable, debounceMs }`
 */
export function useDemoState<S extends Schema>(
  demoSlug: string,
  schema: S,
  initialState: StateOf<S>,
  options: UseDemoStateOptions = {},
): UseDemoStateReturn<S> {
  const shareable = options.shareable ?? true;
  const debounceMs = options.debounceMs ?? 100;

  const [state, setStateInternal] = useState<StateOf<S>>(initialState);
  // Held in a ref so the public `setState`'s identity stays stable across renders.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const demoSlugRef = useRef(demoSlug);
  demoSlugRef.current = demoSlug;
  const initialStateRef = useRef(initialState);
  // initialStateRef intentionally NOT refreshed each render — defaults
  // shouldn't change after the first render (useState ignores them anyway).

  const debounceHandle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: read the URL fragment and adopt any values it carries.
  // Only runs in the browser (window guarded), and only if shareable.
  useEffect(() => {
    if (!shareable) return;
    if (typeof window === "undefined") return;

    const fragment = window.location.hash;
    if (!fragment) return;

    const parsed = deserializeState(fragment, schemaRef.current);
    setStateInternal((prev) => {
      // Merge: keep schema defaults but apply any parsed values that
      // differ. Object.is comparison would over-render if we replaced
      // unconditionally, so check for any change.
      let changed = false;
      const merged = { ...prev } as StateOf<S>;
      for (const key of Object.keys(schemaRef.current)) {
        const k = key as keyof StateOf<S>;
        if (parsed[k] !== prev[k]) {
          merged[k] = parsed[k];
          changed = true;
        }
      }
      return changed ? merged : prev;
    });
    // We deliberately only run this on mount; subsequent fragment edits
    // (e.g., back-button navigation) are out-of-scope for v0.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write fragment on state change, debounced.
  useEffect(() => {
    if (!shareable) return;
    if (typeof window === "undefined") return;

    if (debounceHandle.current !== null) {
      clearTimeout(debounceHandle.current);
    }
    debounceHandle.current = setTimeout(() => {
      const fragment = serializeState(
        state,
        schemaRef.current,
        demoSlugRef.current,
      );
      // Use replaceState to avoid polluting history with every slider tick.
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${fragment}`,
      );
      debounceHandle.current = null;
    }, debounceMs);

    return () => {
      if (debounceHandle.current !== null) {
        clearTimeout(debounceHandle.current);
        debounceHandle.current = null;
      }
    };
  }, [state, shareable, debounceMs]);

  // share() — return current full URL (synchronous, no debounce).
  const share = useCallback((): string => {
    if (typeof window === "undefined") return "";
    const fragment = serializeState(
      state,
      schemaRef.current,
      demoSlugRef.current,
    );
    return `${window.location.origin}${window.location.pathname}${window.location.search}${fragment}`;
  }, [state]);

  // reset() — restore defaults and clear the fragment.
  const reset = useCallback((): void => {
    setStateInternal(initialStateRef.current);
    if (!shareable) return;
    if (typeof window === "undefined") return;
    if (debounceHandle.current !== null) {
      clearTimeout(debounceHandle.current);
      debounceHandle.current = null;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }, [shareable]);

  // Stable setState that accepts either a value or an updater function.
  const setState = useCallback(
    (next: StateOf<S> | ((prev: StateOf<S>) => StateOf<S>)) => {
      setStateInternal(next as StateOf<S>);
    },
    [],
  );

  return [state, setState, { share, reset }];
}
