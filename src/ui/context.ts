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
  refresh: () => Promise<void>;
  toast: (message: string) => void;
};

export type Route =
  | { name: "home" }
  | { name: "add" }
  | { name: "baby"; id: string }
  | { name: "edit"; id: string }
  | { name: "settings" };

export function parseRoute(hash: string): Route {
  const [head, param] = hash.replace(/^#\/?/, "").split("/");

  if (head === "add") return { name: "add" };
  if (head === "settings") return { name: "settings" };
  if (head === "baby" && param) return { name: "baby", id: decodeURIComponent(param) };
  if (head === "edit" && param) return { name: "edit", id: decodeURIComponent(param) };
  return { name: "home" };
}
