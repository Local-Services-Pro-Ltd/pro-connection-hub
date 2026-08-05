import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Check, SlidersHorizontal } from "lucide-react";
import { THEMES, useTheme } from "@/hooks/use-theme";

/** Header control: one-tap light/dark toggle plus a brightness menu. */
export function ThemeControl() {
  const { theme, setTheme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          theme === "light" ? "Switch to dark theme" : "Switch to light theme"
        }
        className="grid h-11 w-11 place-items-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      >
        {theme === "light" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Theme brightness settings"
        aria-expanded={open}
        aria-haspopup="menu"
        className="ml-1 hidden h-11 w-11 place-items-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:grid"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme brightness"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-border bg-popover p-1.5 shadow-lift"
        >
          <p className="eyebrow px-2.5 pb-1.5 pt-1">Brightness</p>
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === t.value}
              onClick={() => {
                setTheme(t.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left hover:bg-muted"
            >
              <span>
                <span className="block font-display text-sm font-semibold">
                  {t.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t.hint}
                </span>
              </span>
              {theme === t.value && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
