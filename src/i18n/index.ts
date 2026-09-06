import { en, type Catalog } from "./en.ts";
import { he } from "./he.ts";

export type Lang = "en" | "he";

export const CATALOGS: Record<Lang, Catalog> = { en, he };

/** The order they are offered in, English first because it is the original. */
export const LANGS: Lang[] = ["en", "he"];

export function catalogFor(lang: Lang): Catalog {
  return CATALOGS[lang];
}

/**
 * Which language a phone is asking for. Anything Hebrew gets Hebrew, whatever
 * the region tag says, and everything else falls to English rather than to
 * whichever language happens to be first in the list.
 */
export function preferredLang(languages: readonly string[]): Lang {
  for (const tag of languages) {
    const base = tag.toLowerCase().split("-")[0];
    // "iw" is the retired code for Hebrew and some devices still send it.
    if (base === "he" || base === "iw") return "he";
    if (base === "en") return "en";
  }
  return "en";
}

export type { Catalog };
