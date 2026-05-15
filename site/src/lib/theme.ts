export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const STORAGE_KEY = "theme-preference";

const VALID_STORED: readonly ThemePreference[] = ["light", "dark"] as const;

export function getStoredPreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (VALID_STORED as readonly string[]).includes(raw)) {
      return raw as ThemePreference;
    }
    return "system";
  } catch {
    return "system";
  }
}

export function setStoredPreference(pref: ThemePreference): void {
  try {
    if (pref === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch {
    // localStorage may be disabled (private mode, quota, etc.); silently ignore.
  }
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") {
    return pref;
  }
  if (typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function initTheme(): void {
  applyTheme(resolveTheme(getStoredPreference()));
}
