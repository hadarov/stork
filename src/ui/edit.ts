import { toISODate } from "../domain/derive.ts";
import type { Baby, BabySex, BabyStatus } from "../domain/types.ts";
import { newId } from "../storage/repo.ts";
import { screenHeader } from "./components.ts";
import type { AppContext } from "./context.ts";
import { el } from "./dom.ts";
import { readPhoto } from "./photo.ts";

type Draft = {
  status: BabyStatus;
  name: string;
  parents: string;
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
    parents: baby?.parents.join(", ") ?? "",
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

  const text = (
    key: "name" | "parents" | "notes",
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
  const paintPreview = (): void => {
    preview.replaceChildren(
      draft.photo
        ? el("img", { class: "avatar avatar-lg", src: draft.photo, alt: "" })
        : el("div", { class: "avatar avatar-lg tint-2", "aria-hidden": "true" }, "\u{1F4F7}"),
    );
  };
  paintPreview();

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
        paintPreview();
      } catch (error) {
        ctx.toast(error instanceof Error ? error.message : "Could not read that image.");
      } finally {
        // Lets the same file be picked again after a failure.
        input.value = "";
      }
    },
  });

  const photoRow = el(
    "div",
    { class: "photo-row" },
    preview,
    el(
      "div",
      { class: "photo-buttons" },
      el(
        "button",
        { class: "secondary", type: "button", onclick: () => photoInput.click() },
        draft.photo ? "Change photo" : "Add a photo",
      ),
      draft.photo
        ? el(
            "button",
            {
              class: "quiet",
              type: "button",
              onclick: (event: Event) => {
                draft.photo = "";
                paintPreview();
                (event.currentTarget as HTMLElement).remove();
              },
            },
            "Remove",
          )
        : null,
    ),
    photoInput,
  );

  /* ------------------------------------------------- expecting or here yet */

  const bornOnly = el("div", { class: "field-group" });
  const dueField = field(
    "Due date",
    dateInput("dueDate"),
    "The date everyone is counting down to.",
  );

  const setStatus = (status: BabyStatus): void => {
    draft.status = status;
    for (const button of segmented.querySelectorAll("button")) {
      const active = button.dataset.status === status;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    bornOnly.hidden = status !== "born";
    const dueLabel = dueField.querySelector(".field-label");
    if (dueLabel) dueLabel.textContent = status === "born" ? "Was due" : "Due date";
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
      el(
        "button",
        {
          type: "button",
          dataset: { status },
          onclick: () => setStatus(status),
        },
        label,
      ),
    ),
  );

  bornOnly.append(
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
    ).map(([value, label]) =>
      el("option", { value, selected: draft.sex === value }, label),
    ),
  );

  /* ------------------------------------------------------------- saving */

  const save = async (): Promise<void> => {
    const parents = draft.parents
      .split(",")
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
    if (draft.dueDate) baby.dueDate = draft.dueDate;
    if (draft.status === "born") {
      baby.birthDate = draft.birthDate;
      if (draft.birthTime) baby.birthTime = draft.birthTime;
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

  function fail(message: string): void {
    errors.textContent = message;
    errors.hidden = false;
    errors.scrollIntoView({ behavior: "smooth", block: "center" });
  }

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
    photoRow,
    field("Name", text("name", { placeholder: "Still deciding?" })),
    field(
      "Parents",
      text("parents", { placeholder: "Sarah, Tom" }),
      "Separate two names with a comma.",
    ),
    dueField,
    bornOnly,
    field("Girl or boy", sexSelect),
    field("Notes", text("notes", { rows: 3, placeholder: "Gift ideas, hospital, anything" })),
    el(
      "div",
      { class: "form-actions" },
      el("button", { class: "primary", type: "submit" }, existing ? "Save" : "Add baby"),
      el("button", { class: "quiet", type: "button", onclick: () => ctx.back() }, "Cancel"),
    ),
  );

  setStatus(draft.status);

  return el(
    "div",
    { class: "screen" },
    screenHeader(existing ? "Edit" : "New baby", { onBack: () => ctx.back() }),
    el("div", { class: "content" }, form),
  );
}
