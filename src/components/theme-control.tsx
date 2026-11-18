import { useEffect, useRef, useState } from "react";
import { Moon, Sun, SunDim, Check, SlidersHorizontal } from "lucide-react";
import { THEMES, useTheme, type Theme } from "@/hooks/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themeIcons = { light: Sun, dim: SunDim, dark: Moon };

/** Compact header menu; the shared theme hook keeps it in sync with the footer. */
export function HeaderThemeControl() {
  const { theme, setTheme } = useTheme();
  const CurrentIcon = themeIcons[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label="Change colour theme"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <CurrentIcon className="h-[18px] w-[18px]" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-44" aria-label="Colour theme">
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {THEMES.map((item) => {
            const Icon = themeIcons[item.value];
            return (
              <DropdownMenuRadioItem
                key={item.value}
                value={item.value}
                className="flex cursor-pointer items-center gap-2 px-3 py-2.5 [&>span:first-child]:hidden"
              >
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span>{item.label}</span>
                {theme === item.value && (
                  <Check className="ml-auto h-4 w-4 text-primary" aria-hidden="true" />
                )}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
        aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        className="grid h-11 w-11 place-items-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      >
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
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
                <span className="block font-display text-sm font-semibold">{t.label}</span>
                <span className="block text-xs text-muted-foreground">{t.hint}</span>
              </span>
              {theme === t.value && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
