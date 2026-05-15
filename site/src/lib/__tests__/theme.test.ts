import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  getStoredPreference,
  initTheme,
  resolveTheme,
  setStoredPreference,
  STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "../theme";

function setMatchMediaPrefersDark(prefersDark: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const matches = query.includes("dark") ? prefersDark : !prefersDark;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  });
}

describe("theme module", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    setMatchMediaPrefersDark(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getStoredPreference", () => {
    it("returns 'system' when nothing stored", () => {
      expect(getStoredPreference()).toBe("system");
    });

    it("returns 'light' when 'light' stored", () => {
      window.localStorage.setItem(STORAGE_KEY, "light");
      expect(getStoredPreference()).toBe("light");
    });

    it("returns 'dark' when 'dark' stored", () => {
      window.localStorage.setItem(STORAGE_KEY, "dark");
      expect(getStoredPreference()).toBe("dark");
    });

    it("returns 'system' when stored value is garbage", () => {
      window.localStorage.setItem(STORAGE_KEY, "neon-pink");
      expect(getStoredPreference()).toBe("system");
    });

    it("returns 'system' when localStorage access throws", () => {
      const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage disabled");
      });
      expect(getStoredPreference()).toBe("system");
      spy.mockRestore();
    });
  });

  describe("setStoredPreference", () => {
    it("persists 'light' to localStorage", () => {
      setStoredPreference("light");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
    });

    it("persists 'dark' to localStorage", () => {
      setStoredPreference("dark");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
    });

    it("removes the key when preference is 'system'", () => {
      window.localStorage.setItem(STORAGE_KEY, "dark");
      setStoredPreference("system");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("does not throw when localStorage write fails", () => {
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage full");
      });
      expect(() => setStoredPreference("dark")).not.toThrow();
      spy.mockRestore();
    });
  });

  describe("resolveTheme", () => {
    it("returns 'light' for explicit 'light'", () => {
      expect(resolveTheme("light")).toBe("light");
    });

    it("returns 'dark' for explicit 'dark'", () => {
      expect(resolveTheme("dark")).toBe("dark");
    });

    it("returns 'dark' for 'system' when OS prefers dark", () => {
      setMatchMediaPrefersDark(true);
      expect(resolveTheme("system")).toBe("dark");
    });

    it("returns 'light' for 'system' when OS prefers light", () => {
      setMatchMediaPrefersDark(false);
      expect(resolveTheme("system")).toBe("light");
    });

    it("falls back to 'light' when matchMedia missing", () => {
      // @ts-expect-error - intentionally removing
      delete window.matchMedia;
      expect(resolveTheme("system")).toBe("light");
    });
  });

  describe("applyTheme", () => {
    it("sets data-theme='light' on documentElement", () => {
      applyTheme("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("sets data-theme='dark' on documentElement", () => {
      applyTheme("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("replaces a previously-set theme attribute", () => {
      document.documentElement.setAttribute("data-theme", "dark");
      applyTheme("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  describe("initTheme", () => {
    it("applies stored 'dark' preference", () => {
      window.localStorage.setItem(STORAGE_KEY, "dark");
      initTheme();
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("applies stored 'light' preference even when OS prefers dark", () => {
      window.localStorage.setItem(STORAGE_KEY, "light");
      setMatchMediaPrefersDark(true);
      initTheme();
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("falls back to system 'dark' when no stored pref and OS prefers dark", () => {
      setMatchMediaPrefersDark(true);
      initTheme();
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("falls back to system 'light' when no stored pref and OS prefers light", () => {
      setMatchMediaPrefersDark(false);
      initTheme();
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  describe("type contracts", () => {
    it("ThemePreference accepts all 3 valid values", () => {
      const prefs: ThemePreference[] = ["light", "dark", "system"];
      expect(prefs).toHaveLength(3);
    });

    it("ResolvedTheme is light or dark only", () => {
      const resolved: ResolvedTheme[] = ["light", "dark"];
      expect(resolved).toHaveLength(2);
    });
  });
});
