import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dim" | "dark";

export const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Bright bone paper" },
  { value: "dim", label: "Dim", hint: "Lifted graphite" },
  { value: "dark", label: "Dark", hint: "Deep graphite" },
];

const STORAGE_KEY = "tf-theme";
const DEFAULT_THEME: Theme = "dim";

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };

const ThemeContext = createContext<Ctx>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggle: () => {},
});

/** Inline script: applies the stored theme before paint to avoid a flash. */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dim"&&t!=="dark"){t="${DEFAULT_THEME}"}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==="light"?"light":"dark"}catch(e){}})();`;

function apply(theme: Theme) {
  const el = document.documentElement;
  el.dataset["theme"] = theme;
  el.style.colorScheme = theme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dim" || stored === "dark") {
      setThemeState(stored);
      apply(stored);
    } else {
      apply(DEFAULT_THEME);
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    apply(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "dim" : "light");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
