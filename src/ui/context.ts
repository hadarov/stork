import type { Baby } from "../domain/types.ts";
import type { BabyRepo } from "../storage/repo.ts";

/** Everything a screen needs, handed down so no screen reaches for a global. */
export type AppContext = {
  repo: BabyRepo;
  babies: Baby[];
  /** Captured once per render so every countdown on screen agrees. */
  now: Date;
  navigate: (path: string) => void;
  back: () => void;
  /** Reloads the book from storage. Does not touch the screen. */
  refresh: () => Promise<void>;
  /**
   * Draws the current route again. Needed by the handful of controls that
   * change a baby without leaving the page they are on, like the gift tick.
   */
  redraw: () => void;
  toast: (message: string) => void;
};

export type Route =
  | { name: "home" }
  | { name: "add" }
  /** Everyone you might be about to see. */
  | { name: "who" }
  /** The thirty seconds before you walk in: one household, everything that matters. */
  | { name: "brief"; id: string }
  /** A new baby for the same parents as an existing one. */
  | { name: "sibling"; id: string }
  | { name: "baby"; id: string }
  | { name: "edit"; id: string }
  /** Asks whether the baby has arrived. Stacks over their page. */
  | { name: "born"; id: string }
  /** Confirms a removal. Stacks over their page. */
  | { name: "remove"; id: string }
  /** One picture from the album, full size. Stacks over their page. */
  | { name: "photo"; id: string; photoId: string }
  | { name: "settings" };

export function parseRoute(hash: string): Route {
  const [head, param, extra] = hash.replace(/^#\/?/, "").split("/");

  if (head === "add") return { name: "add" };
  if (head === "who") return { name: "who" };
  if (head === "settings") return { name: "settings" };
  if (head === "brief" && param) return { name: "brief", id: decodeURIComponent(param) };
  if (head === "sibling" && param) return { name: "sibling", id: decodeURIComponent(param) };
  if (head === "baby" && param) return { name: "baby", id: decodeURIComponent(param) };
  if (head === "edit" && param) return { name: "edit", id: decodeURIComponent(param) };
  if (head === "born" && param) return { name: "born", id: decodeURIComponent(param) };
  if (head === "remove" && param) return { name: "remove", id: decodeURIComponent(param) };
  if (head === "photo" && param && extra) {
    return { name: "photo", id: decodeURIComponent(param), photoId: decodeURIComponent(extra) };
  }
  return { name: "home" };
}
