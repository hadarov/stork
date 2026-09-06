import type { Baby } from "../domain/types.ts";
import type { BabyRepo } from "../storage/repo.ts";
import { renderPhotoViewer } from "./album.ts";
import { renderBrief } from "./brief.ts";
import { emptyState } from "./components.ts";
import { parseRoute, type AppContext, type Route } from "./context.ts";
import { renderDetail } from "./detail.ts";
import { clear, el } from "./dom.ts";
import { onStorageChange } from "./durable.ts";
import { renderEdit } from "./edit.ts";
import { renderHome } from "./home.ts";
import { onInstallChange } from "./installer.ts";
import { currentCatalog, showJewishCalendar, watchSystemLang } from "./lang.ts";
import { popup } from "./modal.ts";
import { renderArrival, renderRemoveConfirm } from "./prompts.ts";
import { renderSettings } from "./settings.ts";

export async function startApp(root: HTMLElement, repo: BabyRepo): Promise<void> {
  let babies: Baby[] = await repo.list();

  const HOME = "#/";
  const here = (): string => location.hash || HOME;

  /**
   * The steps taken inside the app, shallowest first. How deep we currently
   * are is kept in the history entry itself rather than in a counter here,
   * because a counter and the phone's own back button disagree the moment
   * somebody uses both, and then Back starts leaving the app altogether.
   */
  let trail: string[] = [];
  const depth = (): number => {
    const mark = (history.state as { stork?: number } | null | undefined)?.stork;
    return typeof mark === "number" && mark > 0 ? mark : 0;
  };

  /** What is on screen, so one move through history does not draw twice. */
  let shown: string | null = null;

  /** Where the book was left, so shutting a popup does not lose your place. */
  let place = 0;

  const toastNode = el("div", { class: "toast", role: "status", "aria-live": "polite" });
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const toast = (message: string): void => {
    toastNode.textContent = message;
    toastNode.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove("visible"), 2600);
  };

  /**
   * Writes a step into the trail at its own depth, so the two can never drift
   * apart however oddly the back and forward buttons have been used. Anything
   * beyond is dropped, and any gap left behind reads as a step we never took.
   */
  const record = (step: number, path: string): void => {
    trail.length = step;
    trail[step] = path;
  };

  /** A step further in: leaves the current screen behind to come back to. */
  const navigate = (path: string): void => {
    if (here() === path) return render();
    const step = depth() + 1;
    record(step, path);
    history.pushState({ stork: step }, "", path);
    render();
  };

  /** Swaps the current step for another, leaving nothing behind. */
  const replace = (path: string): void => {
    const step = depth();
    record(step, path);
    history.replaceState({ stork: step }, "", path);
    render();
  };

  const back = (): void => {
    // At the shallowest step there is nothing of ours behind us, and calling
    // back would walk out of the app, so the book is drawn in place instead.
    if (depth() > 0) history.back();
    else replace(HOME);
  };

  const finish = (path: string): void => {
    const step = depth();
    // Unwind to the step that is already showing what we want, so the ones the
    // task used are gone rather than sitting there waiting for a back press.
    for (let index = step - 1; index >= 0; index -= 1) {
      // Not truncated: the entries are still real to the browser, and going
      // forward into one has to find its place in the trail.
      if (trail[index] === path) return history.go(index - step);
    }
    replace(path);
  };

  const refresh = async (): Promise<void> => {
    babies = await repo.list();
  };

  function context(): AppContext {
    return {
      repo,
      babies,
      now: new Date(),
      t: currentCatalog(),
      jewish: showJewishCalendar(),
      navigate,
      back,
      finish,
      refresh,
      redraw: render,
      toast,
    };
  }

  /**
   * The popups over the book on this route, outermost first. Confirmations
   * return two, so backing out of the question leaves the baby's page open
   * rather than dumping you back at the grid.
   */
  function overlaysFor(route: Route, ctx: AppContext): HTMLElement[] {
    if (route.name === "home") return [];
    if (route.name === "add") return [renderEdit(ctx, null)];
    if (route.name === "settings") return [renderSettings(ctx)];

    const baby = babies.find((candidate) => candidate.id === route.id);
    if (!baby) {
      // Reachable from a stale bookmark or after a delete, so it must not throw.
      return [
        popup({
          title: "Not here any more",
          onClose: back,
          body: [emptyState("Not here any more", "That baby is no longer in your book.")],
        }),
      ];
    }

    if (route.name === "brief") return [renderBrief(ctx, baby)];
    if (route.name === "sibling") return [renderEdit(ctx, null, baby.parents)];
    if (route.name === "edit") return [renderEdit(ctx, baby)];
    if (route.name === "born") return [renderDetail(ctx, baby), renderArrival(ctx, baby)];
    if (route.name === "remove") {
      return [renderDetail(ctx, baby), renderRemoveConfirm(ctx, baby)];
    }
    if (route.name === "photo") {
      const photo = (baby.photos ?? []).find((candidate) => candidate.id === route.photoId);
      // A deleted photo leaves the page behind rather than an error.
      if (photo) return [renderDetail(ctx, baby), renderPhotoViewer(ctx, baby, photo)];
    }
    return [renderDetail(ctx, baby)];
  }

  function render(): void {
    const ctx = context();
    const route = parseRoute(here());
    const overlays = overlaysFor(route, ctx);

    // The grid is thrown away and drawn again every time, so how far down it
    // you were has to be carried across by hand. Only worth reading while the
    // book is the thing on screen; behind a popup it is whatever it was.
    if (!root.querySelector(".overlay")) place = window.scrollY;

    // The book is always underneath, so closing a popup reveals it already
    // drawn rather than rebuilding a screen behind the animation.
    clear(root);
    root.append(renderHome(ctx), ...overlays, toastNode);
    shown = here();

    if (overlays.length === 0) window.scrollTo(0, place);
  }

  // A reload keeps the entry's depth but not the trail behind it, so the steps
  // we cannot see are left as gaps. Back still works, since the browser kept
  // the entries themselves; finishing a task there just swaps this step for
  // the next rather than unwinding, which is the safe half of the job.
  record(depth(), here());

  // Going back or forward through the app's own steps.
  window.addEventListener("popstate", render);

  // A hash set from outside the app: a typed address, or an old link. The
  // guard is because moving through history fires this as well as popstate.
  window.addEventListener("hashchange", () => {
    if (here() === shown) return;
    record(depth(), here());
    render();
  });

  // Escape closes the popup, the same as tapping the backdrop.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && parseRoute(location.hash).name !== "home") back();
  });

  /**
   * A redraw throws away whatever is typed into the form, so the two background
   * triggers below leave the form alone. Losing a half-filled baby to a glance
   * at a text message would be far worse than a countdown being a day stale.
   */
  const isFilling = (): boolean => {
    const route = parseRoute(location.hash);
    return route.name === "add" || route.name === "edit" || route.name === "sibling";
  };

  // The browser decides whether the app is installable some time after the
  // first paint, and changes its mind again once it has been installed.
  onInstallChange(() => {
    if (!isFilling()) render();
  });

  // Whether storage is persisted is read asynchronously, so it lands late too.
  onStorageChange(() => {
    if (!isFilling()) render();
  });

  // A phone whose language was changed while the app was open.
  watchSystemLang(() => {
    if (!isFilling()) render();
  });

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
