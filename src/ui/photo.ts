/**
 * Photos are held in localStorage alongside everything else, and phone cameras
 * produce files far too big for that, so every picture is squared off and
 * shrunk before it is ever stored.
 */
const MAX_EDGE = 480;
const QUALITY = 0.82;

/**
 * Why a picture would not open, as something a screen can look up rather than
 * a sentence. This file has no language: it is handed a file and gives back a
 * data URL, and the screen that called it is the one that knows what the
 * reader is reading.
 */
export type PhotoProblem = "notAPhoto" | "badPhoto";

export function photoProblem(error: unknown): PhotoProblem {
  return (error as { problem?: PhotoProblem })?.problem === "notAPhoto"
    ? "notAPhoto"
    : "badPhoto";
}

function refuse(problem: PhotoProblem): Error {
  return Object.assign(new Error(problem), { problem });
}

export async function readPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw refuse("notAPhoto");

  const bitmap = await loadBitmap(file);
  try {
    // Centre crop to a square so every avatar lines up on the cards.
    const edge = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - edge) / 2;
    const sy = (bitmap.height - edge) / 2;
    const size = Math.min(edge, MAX_EDGE);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) throw refuse("badPhoto");
    context.drawImage(bitmap, sx, sy, edge, edge, 0, 0, size, size);

    return canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    bitmap.close?.();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    // Honours the EXIF orientation that phone cameras rely on.
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(refuse("badPhoto"));
      image.src = url;
    });
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}
