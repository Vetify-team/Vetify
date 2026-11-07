"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";
import { cn } from "cn";

const THEMES: { value: Theme; text: string; icon: typeof Sun }[] = [
  { value: "system", text: "Como el sistema", icon: Monitor },
  { value: "light", text: "Claro", icon: Sun },
  { value: "dark", text: "Oscuro", icon: Moon },
];

/** Light (paper), dark (warm black) or system theme. `compact` shows icons only. */
export function ThemePicker({ compact }: { compact?: boolean }) {
  // Mounted only on the client (behind ProtectedRoute), so reading
  // localStorage in the initial state does not break hydration.
  const [theme, setTheme] = useState<Theme>(readTheme);

  const choose = (value: Theme) => {
    setTheme(value);
    applyTheme(value);
  };

  return (
    <fieldset className={cn("flex flex-wrap gap-2 text-sm", compact && "gap-1")}>
      <legend className="sr-only">Tema</legend>
      {THEMES.map(({ value, text, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          aria-label={compact ? text : undefined}
          title={compact ? text : undefined}
          onClick={() => choose(value)}
          className={cn(
            "flex items-center gap-2 rounded-full border border-border text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground",
            compact ? "size-8 justify-center" : "min-h-10 px-4",
          )}
        >
          <Icon className="size-4" strokeWidth={1.5} aria-hidden />
          {!compact && text}
        </button>
      ))}
    </fieldset>
  );
}
