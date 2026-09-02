import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readString, writeString } from "./storage";

type Theme = "light" | "dark";

/** Sob o namespace `crm:`; preservada nas migrações (é preferência, não cache). */
const THEME_KEY = "theme";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = readString(THEME_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    // `writeString` já lida com localStorage indisponível (ex.: modo privado).
    writeString(THEME_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { theme: "light" as Theme, toggle: () => {} };
  return ctx;
}
