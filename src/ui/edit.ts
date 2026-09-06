import type { Baby, BabySex, BabyStatus } from "../domain/types.ts";
import { newId } from "../storage/repo.ts";
import type { AppContext } from "./context.ts";
import { dateField } from "./dateField.ts";
import { el } from "./dom.ts";
import { popup } from "./modal.ts";
import { photoProblem, readPhoto } from "./photo.ts";

type Draft = {
  status: BabyStatus;
  name: string;
  /** Held apart rather than as one list, because only the first is expected. */
  parent: string;
  secondParent: string;
  dueDate: string;
  birthDate: string;
  birthTime: string;
  /** Kept as typed, in kilograms and centimetres, and parsed on save. */
  birthWeight: string;
  birthLength: string;
  sex: BabySex | "";
  photo: string;
  notes: string;
};

/** Blank means "not recorded"; null means "recorded, but not believable". */
function measure(text: string, min: number, max: number): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function toDraft(baby: Baby | null, parents: string[]): Draft {
  return {
    status: baby?.status ?? "expecting",
    name: baby?.name ?? "",
    parent: baby?.parents[0] ?? parents[0] ?? "",
    secondParent: baby?.parents[1] ?? parents[1] ?? "",
    dueDate: baby?.dueDate ?? "",
    birthDate: baby?.birthDate ?? "",
    birthTime: baby?.birthTime ?? "",
    birthWeight: baby?.birthWeightGrams ? String(baby.birthWeightGrams / 1000) : "",
    birthLength: baby?.birthLengthCm ? String(baby.birthLengthCm) : "",
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

/**
 * `parents` seeds a brand new baby, which is how adding a sibling saves you
 * typing the same two names again. It is ignored when editing.
 */
export function renderEdit(
  ctx: AppContext,
  existing: Baby | null,
  parents: string[] = [],
): HTMLElement {
  const t = ctx.t;
  const draft = toDraft(existing, parents);
  const errors = el("p", { class: "form-error", role: "alert", hidden: true });

  const textInput = (
    key: "name" | "parent" | "secondParent" | "notes",
    props: Record<string, unknown> = {},
  ): HTMLElement =>
    el(key === "notes" ? "textarea" : "input", {
      class: "input",
      // Everything here is typed by hand, and a Hebrew name in an English book
      // or an English one in a Hebrew book has to read in its own direction
      // from the first letter rather than in the interface's.
      dir: "auto",
      value: draft[key],
      oninput: (event: Event) => {
        draft[key] = (event.target as HTMLInputElement).value;
      },
      ...props,
    });

  const numberInput = (key: "birthWeight" | "birthLength", props: Record<string, unknown> = {}) =>
    el("input", {
      class: "input",
      type: "number",
      inputmode: "decimal",
      min: "0",
      value: draft[key],
      ...props,
      oninput: (event: Event) => {
        draft[key] = (event.target as HTMLInputElement).value;
      },
    });

  const datePicker = (
    key: "dueDate" | "birthDate",
    label: string,
    range: "past" | "future",
    hint?: string,
  ) =>
    dateField({
      label,
      range,
      hint,
      value: draft[key],
      now: ctx.now,
      t,
      onChange: (value) => {
        draft[key] = value;
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
        draft.photo ? t.form.edit.changePhoto : t.form.edit.addPhoto,
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
              t.form.edit.removePhoto,
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
        // Which of the two went wrong is worth saying: picking the wrong sort
        // of file is a thing you can put right, and a picture that will not
        // open is not.
        ctx.toast(t.app[photoProblem(error)]);
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
  const expectingOnly = el(
    "div",
    { class: "field-group" },
    datePicker("dueDate", t.form.edit.dueDate, "future"),
  );
  const bornOnly = el(
    "div",
    { class: "field-group" },
    datePicker("birthDate", t.form.edit.birthday, "past"),
    field(
      t.form.edit.birthTime,
      el("input", {
        class: "input",
        type: "time",
        value: draft.birthTime,
        oninput: (event: Event) => {
          draft.birthTime = (event.target as HTMLInputElement).value;
        },
      }),
      t.form.edit.birthTimeHint,
    ),
    el(
      "div",
      { class: "field-pair" },
      field(
        t.form.edit.weight,
        numberInput("birthWeight", { step: "0.01", placeholder: "3.4" }),
        t.form.edit.kg,
      ),
      field(
        t.form.edit.length,
        numberInput("birthLength", { step: "0.5", placeholder: "51" }),
        t.form.edit.cm,
      ),
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
    { class: "segmented", role: "group", "aria-label": t.form.edit.statusLabel },
    ...(
      [
        ["expecting", `\u{1F95A} ${t.form.edit.statusExpecting}`],
        ["born", `\u{1F423} ${t.form.edit.statusBorn}`],
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
        ["", t.form.edit.sexUnsaid],
        ["girl", t.form.edit.sexGirl],
        ["boy", t.form.edit.sexBoy],
        ["surprise", t.form.edit.sexSurprise],
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

    const weight = measure(draft.birthWeight, 0.2, 8);
    const length = measure(draft.birthLength, 20, 70);

    if (draft.status === "born" && !draft.birthDate) {
      return fail(t.form.edit.needBirthday);
    }
    if (weight === null) return fail(t.form.edit.badWeight(0.2, 8));
    if (length === null) return fail(t.form.edit.badLength(20, 70));
    if (draft.status === "expecting" && !draft.dueDate && !draft.name) {
      return fail(t.form.edit.needDueOrName);
    }
    if (!draft.name && parents.length === 0) {
      return fail(t.form.edit.needNameOrParent);
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
      if (weight !== undefined) baby.birthWeightGrams = Math.round(weight * 1000);
      if (length !== undefined) baby.birthLengthCm = Math.round(length * 10) / 10;
    } else if (draft.dueDate) {
      baby.dueDate = draft.dueDate;
    }
    if (draft.sex) baby.sex = draft.sex;
    if (draft.photo) baby.photo = draft.photo;
    if (draft.notes.trim()) baby.notes = draft.notes.trim();
    if (existing?.giftSent) baby.giftSent = true;

    await ctx.repo.save(baby);
    await ctx.refresh();
    ctx.toast(existing ? t.form.edit.savedToast : t.form.edit.addedToast);
    ctx.finish(`#/baby/${encodeURIComponent(baby.id)}`);
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
    field(t.form.edit.name, textInput("name", { placeholder: t.form.edit.namePlaceholder })),
    field(t.form.edit.parent, textInput("parent", { placeholder: t.form.edit.parentPlaceholder })),
    field(
      t.form.edit.secondParent,
      textInput("secondParent", { placeholder: t.form.edit.optional }),
    ),
    expectingOnly,
    bornOnly,
    field(t.form.edit.sex, sexSelect),
    field(
      t.form.edit.notes,
      textInput("notes", { rows: 3, placeholder: t.form.edit.notesPlaceholder }),
    ),
    el(
      "div",
      { class: "form-actions" },
      el(
        "button",
        { class: "primary", type: "submit" },
        existing ? t.form.edit.save : t.form.edit.add,
      ),
      el(
        "button",
        { class: "quiet", type: "button", onclick: () => ctx.back() },
        t.form.edit.cancel,
      ),
    ),
  );

  setStatus(draft.status);

  return popup({
    title: existing ? t.form.edit.title : t.form.edit.titleNew,
    onClose: () => ctx.back(),
    body: [form],
  });
}
