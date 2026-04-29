import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ThemeContext } from "./themeContext.js";

const STORAGE_KEY = "tiffin_theme";
const PALETTE_STORAGE_KEY = "tiffin_accent_palette";
const PALETTE_IDS = ["orange", "teal", "purple", "rose"];

function getSystemDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** @returns {"light" | "dark"} */
function readInitialTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    if (stored === "system") return getSystemDark() ? "dark" : "light";
  } catch {
    /* ignore */
  }
  return getSystemDark() ? "dark" : "light";
}

function readInitialPalette() {
  if (typeof window === "undefined") return "teal";
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (stored === "mint") return "rose";
    if (stored && PALETTE_IDS.includes(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "teal";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitialTheme);
  const [palette, setPaletteState] = useState(readInitialPalette);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute("data-accent", palette);
  }, [palette]);

  const setTheme = useCallback((next) => {
    if (next !== "light" && next !== "dark") return;
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);
  const setPalette = useCallback((next) => {
    if (!PALETTE_IDS.includes(next)) return;
    setPaletteState(next);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => {
    return {
      theme,
      setTheme,
      resolvedTheme: theme,
      palette,
      setPalette,
      paletteOptions: [
        { id: "orange", label: "Orange Classic" },
        { id: "teal", label: "Teal Blue" },
        { id: "purple", label: "Royal Purple" },
        { id: "rose", label: "Rose Quartz" },
      ],
    };
  }, [theme, setTheme, palette, setPalette]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
