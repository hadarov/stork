/*
 * Which language the app is in, kept the same way the theme is: a choice of
 * "follow the phone" or one of the two, remembered locally.
 *
 * Direction rides along with it rather than being a second setting, because
 * there is no such thing as Hebrew laid out left to right.
 */

import { catalogFor, preferredLang, type Catalog, type Lang } from "../i18n/index.ts";

export type LangChoice = "system" | Lang;

const KEY = "stork.lang";

export function resolveLang(choice: LangChoice, languages: readonly string[]): Lang {
  if (choice === "en" || choice === "he") return choice;
  return preferredLang(languages);
}

export function langChoice(): LangChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "en" || stored === "he" ? stored : "system";
  } catch {
    return "system";
  }
}

export function setLangChoice(choice: LangChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Then it lasts as long as the tab does, which is better than refusing.
  }
  applyLang();
}

function systemLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages ?? (navigator.language ? [navigator.language] : []);
}

export function currentLang(): Lang {
  return resolveLang(langChoice(), systemLanguages());
}

export function currentCatalog(): Catalog {
  return catalogFor(currentLang());
}

/**
 * Puts the language and its direction on the document itself, so the browser
 * mirrors the layout, picks the right quotation marks and hyphenation, and
 * reads it out in the right voice.
 */
export function applyLang(): void {
  const t = currentCatalog();
  const root = document.documentElement;
  root.lang = t.code;
  root.dir = t.dir;
}

/*
 * The Hebrew calendar is a separate switch from the language, because the two
 * questions are genuinely different: plenty of people read an app in English
 * and still want to know that the baby was born on Chanukah. It follows the
 * language until somebody says otherwise, which is right nearly every time and
 * asks nothing of anybody.
 */

const JEWISH = "stork.hebrewCalendar";

export function jewishChoice(): boolean | undefined {
  try {
    const stored = localStorage.getItem(JEWISH);
    return stored === "on" ? true : stored === "off" ? false : undefined;
  } catch {
    return undefined;
  }
}

export function showJewishCalendar(): boolean {
  return jewishChoice() ?? currentLang() === "he";
}

export function setJewishCalendar(on: boolean | undefined): void {
  try {
    if (on === undefined) localStorage.removeItem(JEWISH);
    else localStorage.setItem(JEWISH, on ? "on" : "off");
  } catch {
    // Same as everywhere else: it lasts as long as the tab does.
  }
}

/** Follows the phone while the app is open, not only when it is launched. */
export function watchSystemLang(onChange: () => void): void {
  if (typeof window === "undefined") return;
  window.addEventListener("languagechange", () => {
    if (langChoice() !== "system") return;
    applyLang();
    onChange();
  });
}
