import { localRepo } from "./storage/localRepo.ts";
import { watchRepo } from "./storage/watchRepo.ts";
import { startApp } from "./ui/app.ts";
import { scheduleAutoBackup } from "./ui/keeper.ts";

const root = document.getElementById("app");

// Every write goes past the keeper, so an automatic backup cannot be missed by
// a screen that forgot to mention it had changed something.
const repo = watchRepo(localRepo, () => scheduleAutoBackup(localRepo));

if (root) {
  void startApp(root, repo).then(() => {
    if (localRepo.persistenceFailed) {
      // Private browsing and a full disk both look like this, and silently
      // losing every baby the moment the tab closes would be worse than a note.
      root.prepend(
        Object.assign(document.createElement("p"), {
          className: "banner",
          textContent:
            "This browser will not let Stork save anything, so nothing you add here will survive closing the tab.",
        }),
      );
    }
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js").catch(() => {
      // An unregistered worker only costs offline support, so this is not fatal.
    });
  });
}
