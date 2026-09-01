import type { Baby } from "../domain/types.ts";
import type { BabyRepo } from "../storage/repo.ts";
import { emptyState } from "./components.ts";
import { parseRoute, type AppContext } from "./context.ts";
import { renderDetail } from "./detail.ts";
import { clear, el } from "./dom.ts";
import { renderEdit } from "./edit.ts";
import { renderHome } from "./home.ts";
import { renderSettings } from "./settings.ts";

export async function startApp(root: HTMLElement, repo: BabyRepo): Promise<void> {
  let babies: Baby[] = await repo.list();
  /** Depth of navigation done inside the app, so Back never leaves the site. */
  let pushes = 0;

  const toastNode = el("div", { class: "toast", role: "status", "aria-live": "polite" });
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const toast = (message: string): void => {
    toastNode.textContent = message;
    toastNode.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove("visible"), 2600);
  };

  const navigate = (path: string): void => {
    if (location.hash === path) return render();
    pushes += 1;
    location.hash = path;
  };

  const back = (): void => {
    if (pushes > 0) {
      pushes -= 1;
      history.back();
    } else {
      location.hash = "#/";
    }
  };

  const refresh = async (): Promise<void> => {
    babies = await repo.list();
  };

  function context(): AppContext {
    return { repo, babies, now: new Date(), navigate, back, refresh, toast };
  }

  function render(): void {
    const ctx = context();
    const route = parseRoute(location.hash);

    let screen: HTMLElement;
    if (route.name === "add") {
      screen = renderEdit(ctx, null);
    } else if (route.name === "settings") {
      screen = renderSettings(ctx);
    } else if (route.name === "baby" || route.name === "edit") {
      const baby = babies.find((candidate) => candidate.id === route.id);
      if (!baby) {
        // Reachable from a stale bookmark or after a delete, so it must not throw.
        screen = el(
          "div",
          { class: "screen" },
          el(
            "div",
            { class: "content" },
            emptyState(
              "Not here any more",
              "That baby is no longer in your book.",
              el("button", { class: "primary", type: "button", onclick: () => navigate("#/") }, "Back to the book"),
            ),
          ),
        );
      } else {
        screen = route.name === "edit" ? renderEdit(ctx, baby) : renderDetail(ctx, baby);
      }
    } else {
      screen = renderHome(ctx);
    }

    clear(root);
    root.append(screen, toastNode);
    // A fresh screen should start at the top, not wherever the last one was.
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", render);

  /**
   * A redraw throws away whatever is typed into the form, so the two background
   * triggers below leave the form alone. Losing a half-filled baby to a glance
   * at a text message would be far worse than a countdown being a day stale.
   */
  const isFilling = (): boolean => {
    const route = parseRoute(location.hash);
    return route.name === "add" || route.name === "edit";
  };

  // Another tab editing the same book should not leave this one stale.
  window.addEventListener("storage", () => {
    void refresh().then(() => {
      if (!isFilling()) render();
    });
  });

  // Countdowns are wrong the moment the clock passes midnight.
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden && !isFilling()) render();
  });

  render();
}
