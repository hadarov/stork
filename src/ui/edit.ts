import { toISODate } from "../domain/derive.ts";
import type { Baby, BabySex, BabyStatus } from "../domain/types.ts";
import { newId } from "../storage/repo.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";
import { popup } from "./modal.ts";
import { readPhoto } from "./photo.ts";

type Draft = {
  status: BabyStatus;
  name: string;
  /** Held apart rather than as one list, because only the first is expected. */
  parent: string;
  secondParent: string;
  dueDate: string;
  birthDate: string;
  birthTime: string;
  sex: BabySex | "";
  photo: string;
  notes: string;
};

function toDraft(baby: Baby | null): Draft {
  return {
    status: baby?.status ?? "expecting",
    name: baby?.name ?? "",
    parent: baby?.parents[0] ?? "",
    secondParent: baby?.parents[1] ?? "",
    dueDate: baby?.dueDate ?? "",
    birthDate: baby?.birthDate ?? "",
    birthTime: baby?.birthTime ?? "",
    sex: baby?.sex ?? "",
    photo: baby?.photo ?? "",
    notes: baby?.notes ?? "",
  };
}

function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
  return el(
    "label",
    { class: "field" },
    el("span", { class: "field-label" }, label),
    control,
    hint ? el("span", { class: "field-hint" }, hint) : null,
  );
}

export function renderEdit(ctx: AppContext, existing: Baby | null): HTMLElement {
  const draft = toDraft(existing);
  const errors = el("p", { class: "form-error", role: "alert", hidden: true });

  const textInput = (
    key: "name" | "parent" | "secondParent" | "notes",
    props: Record<string, unknown> = {},
  ): HTMLElement =>
    el(key === "notes" ? "textarea" : "input", {
      class: "input",
      value: draft[key],
      oninput: (event: Event) => {
        draft[key] = (event.target as HTMLInputElement).value;
      },
      ...props,
    });

  const dateInput = (key: "dueDate" | "birthDate", props: Record<string, unknown> = {}) =>
    el("input", {
      class: "input",
      type: "date",
      value: draft[key],
      ...props,
      oninput: (event: Event) => {
        draft[key] = (event.target as HTMLInputElement).value;
      },
    });

  /* ----------------------------------------------------------- the photo */

  const preview = el("div", { class: "photo-preview" });
  const photoButtons = el("div", { class: "photo-buttons" });

  const paintPhoto = (): void => {
    preview.replaceChildren(
      draft.photo
        ? el("img", { class: "avatar avatar-lg", src: draft.photo, alt: "" })
        : el("div", { class: "avatar avatar-lg tint-2", "aria-hidden": "true" }, "\u{1F4F7}"),
    );
    photoButtons.replaceChildren(
      el(
        "button",
        { class: "secondary", type: "button", onclick: () => photoInput.click() },
        draft.photo ? "Change photo" : "Add a photo",
      ),
      ...(draft.photo
        ? [
            el(
              "button",
              {
                class: "quiet",
                type: "button",
                onclick: () => {
                  draft.photo = "";
                  paintPhoto();
                },
              },
              "Remove",
            ),
          ]
        : []),
    );
  };

  const photoInput = el("input", {
    type: "file",
    accept: "image/*",
    hidden: true,
    onchange: async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      try {
        draft.photo = await readPhoto(file);
        paintPhoto();
      } catch (error) {
        ctx.toast(error instanceof Error ? error.message : "Could not read that image.");
      } finally {
        // Lets the same file be picked again after a failure.
        input.value = "";
      }
    },
  });

  paintPhoto();

  /* --------------------------------------------- on the way, or here yet */

  // A bump has a due date and a baby has a birthday. Never both: the two are
  // answers to the same question, and showing both invites contradictions.
  const expectingOnly = el("div", { class: "field-group" }, field("Due date", dateInput("dueDate")));
  const bornOnly = el(
    "div",
    { class: "field-group" },
    field("Birthday", dateInput("birthDate", { max: toISODate(ctx.now) })),
    field(
      "Time of birth",
      el("input", {
        class: "input",
        type: "time",
        value: draft.birthTime,
        oninput: (event: Event) => {
          draft.birthTime = (event.target as HTMLInputElement).value;
        },
      }),
      "Optional, but it settles a star sign born on a cusp.",
    ),
  );

  const setStatus = (status: BabyStatus): void => {
    draft.status = status;
    for (const button of segmented.querySelectorAll("button")) {
      const active = button.dataset.status === status;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    expectingOnly.hidden = status !== "expecting";
    bornOnly.hidden = status !== "born";
  };

  const segmented = el(
    "div",
    { class: "segmented", role: "group", "aria-label": "Has the baby arrived?" },
    ...(
      [
        ["expecting", "\u{1F423} On the way"],
        ["born", "\u{1F476} Here"],
      ] as const
    ).map(([status, label]) =>
      el("button", { type: "button", dataset: { status }, onclick: () => setStatus(status) }, label),
    ),
  );

  const sexSelect = el(
    "select",
    {
      class: "input",
      onchange: (event: Event) => {
        draft.sex = (event.target as HTMLSelectElement).value as BabySex | "";
      },
    },
    ...(
      [
        ["", "Rather not say"],
        ["girl", "Girl"],
        ["boy", "Boy"],
        ["surprise", "A surprise"],
      ] as const
    ).map(([value, label]) => el("option", { value, selected: draft.sex === value }, label)),
  );

  /* ------------------------------------------------------------- saving */

  function fail(message: string): void {
    errors.textContent = message;
    errors.hidden = false;
    errors.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const save = async (): Promise<void> => {
    const parents = [draft.parent, draft.secondParent]
      .map((part) => part.trim())
      .filter(Boolean);

    if (draft.status === "born" && !draft.birthDate) {
      return fail("A birthday is needed once the baby is here.");
    }
    if (draft.status === "expecting" && !draft.dueDate && !draft.name) {
      return fail("Add a due date, or at least a name to remember them by.");
    }
    if (!draft.name && parents.length === 0) {
      return fail("Add a name, or whose baby this is.");
    }

    const baby: Baby = {
      id: existing?.id ?? newId(),
      parents,
      status: draft.status,
      updatedAt: new Date().toISOString(),
    };
    if (draft.name) baby.name = draft.name.trim();
    // Only the date that belongs to the current state is kept, so switching
    // from a bump to a baby leaves no stale due date behind.
    if (draft.status === "born") {
      baby.birthDate = draft.birthDate;
      if (draft.birthTime) baby.birthTime = draft.birthTime;
    } else if (draft.dueDate) {
      baby.dueDate = draft.dueDate;
    }
    if (draft.sex) baby.sex = draft.sex;
    if (draft.photo) baby.photo = draft.photo;
    if (draft.notes.trim()) baby.notes = draft.notes.trim();
    if (existing?.giftSent) baby.giftSent = true;

    await ctx.repo.save(baby);
    await ctx.refresh();
    ctx.toast(existing ? "Saved" : "Added");
    ctx.navigate(`#/baby/${encodeURIComponent(baby.id)}`);
  };

  const form = el(
    "form",
    {
      class: "form",
      // Returning the promise is what lets a test await the save; the browser
      // ignores the return value of a listener.
      onsubmit: (event: Event) => {
        event.preventDefault();
        return save();
      },
    },
    errors,
    segmented,
    el("div", { class: "photo-row" }, preview, photoButtons, photoInput),
    field("Name", textInput("name", { placeholder: "Still deciding?" })),
    field("Parent", textInput("parent", { placeholder: "Sarah" })),
    field("Second parent", textInput("secondParent", { placeholder: "Optional" })),
    expectingOnly,
    bornOnly,
    field("Girl or boy", sexSelect),
    field("Notes", textInput("notes", { rows: 3, placeholder: "Gift ideas, hospital, anything" })),
    el(
      "div",
      { class: "form-actions" },
      el("button", { class: "primary", type: "submit" }, existing ? "Save" : "Add baby"),
      el("button", { class: "quiet", type: "button", onclick: () => ctx.back() }, "Cancel"),
    ),
  );

  setStatus(draft.status);

  return popup({
    title: existing ? "Edit" : "New baby",
    onClose: () => ctx.back(),
    body: [form],
  });
}
