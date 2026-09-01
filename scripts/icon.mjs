/*
 * Draws the app icon and encodes it as a PNG, with no dependencies.
 *
 * A home-screen web app needs real PNGs - iOS will not take an SVG for the
 * touch icon and Android wants a maskable one - and there is no image library
 * available here, so the chick is rasterised from shapes and the PNG is written
 * by hand on top of node:zlib.
 */
import { deflateSync } from "node:zlib";

/* ------------------------------------------------------------- the chick */

const BG_TOP = [253, 227, 234];
const BG_BOTTOM = [244, 190, 205];
const CREAM = [255, 250, 246];
const INK = [74, 59, 66];
const BEAK = [242, 166, 90];
const CHEEK = [247, 179, 196];

const circle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/** Diamond beak: an L1 ball, squashed to be taller than it is wide. */
const diamond = (x, y, cx, cy, rx, ry) =>
  Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1;

function insideRoundedSquare(x, y, radius) {
  const dx = Math.max(radius - x, 0, x - (1 - radius));
  const dy = Math.max(radius - y, 0, y - (1 - radius));
  return dx * dx + dy * dy <= radius * radius;
}

function blend(base, colour, alpha = 1) {
  return [
    base[0] + (colour[0] - base[0]) * alpha,
    base[1] + (colour[1] - base[1]) * alpha,
    base[2] + (colour[2] - base[2]) * alpha,
    base[3] + (1 - base[3]) * alpha,
  ];
}

/**
 * Colour at one sample point, in a unit square. `scale` shrinks the chick
 * towards the middle for the maskable icon, whose corners get cropped away.
 */
function sample(x, y, { maskable }) {
  const cornerRadius = maskable ? 0 : 0.22;
  if (!maskable && !insideRoundedSquare(x, y, cornerRadius)) return [0, 0, 0, 0];

  const t = y;
  let colour = [
    BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t,
    BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t,
    BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t,
    1,
  ];

  // Everything below is drawn in the chick's own space, then scaled in place.
  const scale = maskable ? 0.74 : 1;
  const cx = 0.5 + (x - 0.5) / scale;
  const cy = 0.5 + (y - 0.5) / scale;

  if (circle(cx, cy, 0.5, 0.245, 0.042)) colour = blend(colour, CREAM);
  if (circle(cx, cy, 0.5, 0.57, 0.295)) colour = blend(colour, CREAM);
  if (circle(cx, cy, 0.335, 0.635, 0.048)) colour = blend(colour, CHEEK, 0.75);
  if (circle(cx, cy, 0.665, 0.635, 0.048)) colour = blend(colour, CHEEK, 0.75);
  if (circle(cx, cy, 0.412, 0.515, 0.037)) colour = blend(colour, INK);
  if (circle(cx, cy, 0.588, 0.515, 0.037)) colour = blend(colour, INK);
  if (diamond(cx, cy, 0.5, 0.617, 0.055, 0.078)) colour = blend(colour, BEAK);

  return colour;
}

/** 4x4 supersampling, which is enough to keep the curves smooth at 48px. */
const SAMPLES = 4;

export function renderIcon(size, options = {}) {
  const maskable = options.maskable === true;
  const rgba = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const [sr, sg, sb, sa] = sample(
            (px + (sx + 0.5) / SAMPLES) / size,
            (py + (sy + 0.5) / SAMPLES) / size,
            { maskable },
          );
          r += sr * sa;
          g += sg * sa;
          b += sb * sa;
          a += sa;
        }
      }

      const total = SAMPLES * SAMPLES;
      const offset = (py * size + px) * 4;
      // Un-premultiply, so edge pixels keep their colour instead of going dark.
      rgba[offset] = a > 0 ? Math.round(r / a) : 0;
      rgba[offset + 1] = a > 0 ? Math.round(g / a) : 0;
      rgba[offset + 2] = a > 0 ? Math.round(b / a) : 0;
      rgba[offset + 3] = Math.round((a / total) * 255);
    }
  }

  return encodePng(size, size, rgba);
}

/* --------------------------------------------------------- PNG container */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  // Every scanline is prefixed with its filter type; 0 means "none".
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
