import { cardContent } from "../domain/card.ts";
import { displayName } from "../domain/derive.ts";
import type { Baby } from "../domain/types.ts";
import { glyphFor, tintIndex } from "./components.ts";
import { downloadBlob } from "./dom.ts";

/*
 * A card is drawn rather than screenshotted, so it looks the same whatever
 * phone it came from and carries none of the app's furniture. Portrait, at the
 * shape a messaging app will preview without cropping the name off.
 */
const WIDTH = 1080;
const HEIGHT = 1350;

const EDGE = "#6d4a5a";
const INK = "#4b3340";
const MUTED = "#9d8290";
const CREAM = "#fff6f0";
const DEEP = "#cf3c72";

/** The same six the tiles use, so a card matches the square it came from. */
const TINTS = ["#ffd3e0", "#b9f0d5", "#dcd0ff", "#ffeeb0", "#ffd5b8", "#c6e6ff"];

const FACE = 'ui-rounded, "SF Pro Rounded", "Segoe UI", Nunito, system-ui, sans-serif';

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FACE}`;
}

/** Shrinks a line until it fits, rather than letting it run off the card. */
function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  maxWidth: number,
): void {
  let current = size;
  do {
    context.font = font(weight, current);
    current -= 4;
  } while (context.measureText(text).width > maxWidth && current > size / 2);
}

/** Width of the pill that would hold this text at the current font. */
function pillWidth(context: CanvasRenderingContext2D, text: string, height: number): number {
  return context.measureText(text).width + height * 1.1;
}

function pill(
  context: CanvasRenderingContext2D,
  text: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fill: string,
  colour: string,
): void {
  context.beginPath();
  context.roundRect(left, top, width, height, height / 2);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = EDGE;
  context.stroke();

  context.fillStyle = colour;
  context.textBaseline = "middle";
  context.fillText(text, left + width / 2, top + height / 2);
  context.textBaseline = "alphabetic";
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
}

export async function drawCard(baby: Baby, now: Date): Promise<Blob> {
  const content = cardContent(baby, now);
  const tint = TINTS[tintIndex(baby.id)] ?? TINTS[0]!;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw a card.");

  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, tint);
  sky.addColorStop(1, CREAM);
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // The panel, outlined like everything else in the app.
  const inset = 56;
  context.beginPath();
  context.roundRect(inset, inset, WIDTH - inset * 2, HEIGHT - inset * 2, 64);
  context.fillStyle = "#ffffff";
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = EDGE;
  context.stroke();

  const centre = WIDTH / 2;
  const radius = 200;
  const portraitY = 200 + radius;

  context.save();
  context.beginPath();
  context.arc(centre, portraitY, radius, 0, Math.PI * 2);
  context.fillStyle = tint;
  context.fill();
  context.clip();
  if (baby.photo) {
    const image = await loadImage(baby.photo);
    context.drawImage(image, centre - radius, portraitY - radius, radius * 2, radius * 2);
  } else {
    context.font = font(400, 200);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = INK;
    context.fillText(glyphFor(baby), centre, portraitY + 10);
    context.textBaseline = "alphabetic";
  }
  context.restore();

  context.beginPath();
  context.arc(centre, portraitY, radius, 0, Math.PI * 2);
  context.lineWidth = 10;
  context.strokeStyle = EDGE;
  context.stroke();

  context.textAlign = "center";
  const maxWidth = WIDTH - inset * 2 - 100;

  fitText(context, content.name, 800, 96, maxWidth);
  context.fillStyle = INK;
  context.fillText(content.name, centre, portraitY + radius + 130);

  let y = portraitY + radius + 130;
  if (content.parents) {
    y += 62;
    context.font = font(600, 42);
    context.fillStyle = MUTED;
    context.fillText(content.parents, centre, y);
  }

  y += 70;
  fitText(context, content.headline, 800, 62, maxWidth - 180);
  const headline = pillWidth(context, content.headline, 108);
  pill(context, content.headline, centre - headline / 2, y, headline, 108, DEEP, "#ffffff");

  // One row rather than a stack: three of them stacked would run into the
  // footer, and side by side is how badges want to sit anyway.
  y += 108 + 48;
  const gap = 20;
  const chipHeight = 76;
  let size = 38;
  let widths: number[] = [];
  do {
    context.font = font(700, size);
    widths = content.chips.map((text) => pillWidth(context, text, chipHeight));
    size -= 3;
  } while (
    widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1) > maxWidth &&
    size > 22
  );

  let x = centre - (widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1)) / 2;
  content.chips.forEach((text, index) => {
    const width = widths[index]!;
    pill(context, text, x, y, width, chipHeight, tint, INK);
    x += width + gap;
  });

  context.font = font(600, 38);
  context.fillStyle = MUTED;
  context.fillText(content.footer, centre, HEIGHT - inset - 96);

  context.font = font(700, 32);
  context.fillStyle = EDGE;
  context.fillText("\u{1F423} Stork", centre, HEIGHT - inset - 40);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not make a card."))),
      "image/png",
    );
  });
}

/**
 * Hands the card to the phone's share sheet where there is one, since the
 * point of a card is to send it, and falls back to saving the file where
 * there is not.
 */
export async function shareCard(baby: Baby, now: Date): Promise<string> {
  const blob = await drawCard(baby, now);
  const filename = `${displayName(baby).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: displayName(baby) });
      return "Shared";
    } catch (error) {
      // Backing out of the share sheet is a choice, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return "";
    }
  }

  downloadBlob(filename, blob);
  return "Card saved to your downloads";
}
