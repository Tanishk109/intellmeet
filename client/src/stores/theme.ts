import { create } from "zustand";

export type ThemeMode = "dark" | "bright";

const STORAGE_KEY = "intellmeet-theme";

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode === "bright" ? "light" : "dark";
}

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "bright" || stored === "dark" ? stored : "dark";
}

export function syncThemeFromStorage(): ThemeMode {
  const mode = readInitialTheme();
  applyTheme(mode);
  return mode;
}

interface ThemeState {
  mode: ThemeMode;
  init: () => void;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: readInitialTheme(),

  init: () => {
    set({ mode: syncThemeFromStorage() });
  },

  setMode: (mode) => {
    window.localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
    set({ mode });
  },

  toggle: () => {
    get().setMode(get().mode === "dark" ? "bright" : "dark");
  },
}));
