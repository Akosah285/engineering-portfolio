/**
 * useDemoState — URL fragment state serialization for shareable demos.
 *
 * Pure functions exported here. The React hook lives at the bottom and wraps
 * these. Pure functions are tested in isolation; the hook is tested via
 * integration tests in v0-s12 (issue #13).
 *
 * Fragment format: `#demo=<demo-slug>&<key>=<value>&...`
 *   - Values are URL-encoded.
 *   - Numbers serialize via Number.prototype.toString() (preserves precision
 *     within Number.MAX_SAFE_INTEGER).
 *   - Strings are URL-encoded.
 *   - Enums serialize as their string form.
 */

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
