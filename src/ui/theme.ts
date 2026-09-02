/*
 * Dark is the default and the identity: the babies are the colourful part, and
 * they read as stickers on a black surface rather than as pastel on pastel.
 * Light is still there for anyone who wants it.
 */

export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "stork.theme";

/** The bar at the top of the phone, matched to whichever surface is behind it. */
const BAR: Record<Theme, string> = { dark: "#141017", light: "#ffd3e0" };

export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): Theme {
  if (choice === "light" || choice === "dark") return choice;
  return prefersLight ? "light" : "dark";
}

export function themeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Then it lasts as long as the tab does, which is better than refusing.
  }
  applyTheme();
}

function prefersLight(): boolean {
  return (
    typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches
  );
}

export function applyTheme(): void {
  const theme = resolveTheme(themeChoice(), prefersLight());
  document.documentElement.dataset.theme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BAR[theme]);
}

/** Follows the system while the app is open, not only when it is launched. */
export function watchSystemTheme(): void {
  if (typeof matchMedia !== "function") return;
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (themeChoice() === "system") applyTheme();
  });
}
