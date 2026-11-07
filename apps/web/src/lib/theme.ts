/**
 * Light (paper) or dark (warm black) theme. Follows the system by default;
 * the user can pin one in Settings. The preference lives in the browser.
 */

export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "vetify:theme";

/** Runs in <head> before paint to avoid a theme flash; it carries the CSP nonce. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"system";var o=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",o)}catch(e){}})()`;

export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the theme lasts as long as the tab.
  }
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
