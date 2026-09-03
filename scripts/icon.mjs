/*
 * Draws the app icon and encodes it as a PNG, with no dependencies.
 *
 * A home-screen web app needs real PNGs - iOS will not take an SVG for the
 * touch icon and Android wants a maskable one - and there is no image library
 * available here, so the chick is rasterised from shapes and the PNG is written
 * by hand on top of node:zlib.
 */
import { deflateSync } from "node:zlib";

/* -------------------------------------------------------- the hatchling */

/*
 * A chick just out of the shell, wings over the rim. It is the middle of the
 * app's own three stages - egg, hatchling, chick - and the only one of them
 * that is an event rather than a state, which is the thing the app exists to
 * catch.
 *
 * Nothing here is filled flat. Every part hands back a surface normal and one
 * light decides the colour from it, because roundness is the whole difference
 * between an object and a sticker.
 */

/*
 * Materials, not colours: each is what it looks like in shadow, in plain light,
 * and where the light bounces straight back. Shading by scaling a single colour
 * toward black is what makes a drawing look like grey plastic - a chick in
 * shadow is a deeper amber, not a dimmer yellow - so the hue is carried by hand.
 */
const CHICK = [
  [210, 138, 24],
  [253, 214, 65],
  [255, 244, 172],
];
const WING = [
  [186, 118, 20],
  [238, 192, 52],
  [252, 230, 138],
];
const SHELL = [
  [201, 186, 163],
  [247, 242, 232],
  [255, 254, 250],
];
const BEAK = [
  [196, 82, 22],
  [245, 138, 56],
  [255, 198, 134],
];

const BG = [20, 16, 23];
const FLUFF = [214, 152, 28];
/* Warm near-black rather than true black: pure black eyes read as doll eyes. */
const EYE = [46, 34, 36];
const BLUSH = [244, 146, 112];
/* Shadows are warm too, because everything casting one here is warm. */
const SHADOW = [46, 30, 24];

/* One light: upper left, tipped toward the viewer. */
const LX = -0.42;
const LY = -0.62;
const LZ = 0.66;

const HEAD = [0.5, 0.4, 0.175];
const BEAK_AT = [0.5, 0.452, 0.045, 0.032];
const EYES = [
  [0.437, 0.372],
  [0.563, 0.372],
];
const EYE_R = 0.0215;
const BLUSH_AT = [
  [0.393, 0.437],
  [0.607, 0.437],
];
const WISP = [0.55, 0.26, 0.17];
/* The broken rim: where it sits, how deep the teeth are, how many, and phase. */
const RIM = [0.53, 0.045, 9.5, 0.25];
/*
 * Each wing runs from a point inside the head to one well outside it. The
 * buried end is the point: it is never seen, so the wing has nowhere to have
 * come from except the body. Drawn as a free-floating ellipse instead, the
 * same shape reads as a severed mitten resting on the shell.
 */
const WINGS = [
  [0.428, 0.452, 0.327, 0.556, 0.052, 0.033],
  [0.572, 0.452, 0.673, 0.556, 0.052, 0.033],
];

const lerp = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const dim = (colour, k) => (k > 0 ? lerp(colour, SHADOW, k) : colour);
const circle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

const unit = (x, y, z) => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

/**
 * Turn a surface normal into a colour.
 *
 * The light walks the material's three tones rather than scaling one of them.
 * On top sits a tight white specular where the light bounces straight back, and
 * a rim light along the far edge, so the shape lifts off a near-black square
 * instead of dissolving into it.
 */
function surface(material, normal, options = {}) {
  const { pivot = 0.55, soft = 0.75, gloss = 0.5, tight = 30, rim = 0.35 } = options;
  const [deep, plain, bright] = material;
  const [nx, ny, nz] = normal;
  const towards = nx * LX + ny * LY + nz * LZ;
  const t = Math.max(0, towards) ** soft;
  const body =
    t <= pivot ? lerp(deep, plain, t / pivot) : lerp(plain, bright, (t - pivot) / (1 - pivot));
  const specular = towards > 0 ? Math.max(0, 2 * nz * towards - LZ) ** tight * gloss : 0;
  const halo = rim * (1 - nz) ** 3 * Math.max(0, -(nx * LX + ny * LY));
  return lerp(body, [255, 255, 255], Math.min(0.85, specular + halo));
}

/*
 * `puff` above 1 flattens the middle and hurries the falloff at the edge, which
 * is how something soft is shaded rather than something hard. A true sphere,
 * which is puff 1, looks grim at this size.
 */
function ballNormal(x, y, cx, cy, r, puff = 1.7) {
  const dx = (x - cx) / r;
  const dy = (y - cy) / r;
  const d2 = dx * dx + dy * dy;
  if (d2 > 1) return null;
  return unit(dx, dy, Math.sqrt(Math.max(0, 1 - d2 ** puff)));
}

/**
 * An egg, which is an ellipse whose top half is longer than its bottom half and
 * narrower with it. The taper is the entire difference; without it this is an
 * oval, and an oval is not an egg.
 */
function eggNormal(x, y, cx, cy, rx, ryTop, ryBottom, puff = 1.9) {
  const dy = y - cy;
  const v = dy / (dy < 0 ? ryTop : ryBottom);
  const u = (x - cx) / (rx * (1 - 0.13 * Math.max(0, -v)));
  const d2 = u * u + v * v;
  if (d2 > 1) return null;
  return unit(u, v, Math.sqrt(Math.max(0, 1 - d2 ** puff)));
}

/** A wing: a lobe fat where it joins the body, tapering to a tip. */
function wingNormal(x, y, ax, ay, bx, by, r0, r1, puff = 1.7) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
  const r = r0 + (r1 - r0) * t;
  const dx = (x - (ax + vx * t)) / r;
  const dy = (y - (ay + vy * t)) / r;
  const d2 = dx * dx + dy * dy;
  if (d2 > 1) return null;
  return unit(dx, dy, Math.sqrt(Math.max(0, 1 - d2 ** puff)));
}

/** A beak, shaded as a soft wedge so it comes forward off the face. */
function beakNormal(x, y, cx, cy, rx, ry) {
  const u = (x - cx) / rx;
  const v = (y - cy) / ry;
  const d = Math.abs(u) + Math.abs(v);
  if (d > 1) return null;
  return unit(u * 0.85, v * 0.85, Math.sqrt(Math.max(0, 1 - d ** 2.4)));
}

/** A single tapering wisp: one hook off to the side, never a symmetrical arc. */
function wisp(x, y, cx, cy, scale) {
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    const angle = Math.PI * (1.05 - 0.95 * t);
    const px = cx + Math.cos(angle) * scale * (0.34 - 0.13 * t);
    const py = cy - Math.sin(angle) * scale * (0.34 - 0.13 * t) * 0.85;
    if (Math.hypot(x - px, y - py) <= scale * (0.135 - 0.075 * t)) return true;
  }
  return false;
}

/** A broken edge: a triangle wave, so the shell tore rather than was cut. */
const torn = (x, at, amp, freq, phase) =>
  at + amp * (Math.abs(((x * freq + phase) % 1) * 2 - 1) - 0.5);

/** The shadow in the crevice where the chick goes down behind the rim. */
function crease(x, y) {
  const depth = torn(x, ...RIM) - y;
  if (depth < 0 || depth > 0.06) return 0;
  return (1 - depth / 0.06) ** 1.5 * 0.5;
}

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

/** The square is not one colour: a glow where the light is, a cast below it. */
function ground(x, y) {
  const glow = Math.max(0, 1 - Math.hypot((x - 0.4) / 0.92, (y - 0.32) / 0.92)) ** 2;
  const cast = Math.max(0, 1 - Math.hypot((x - 0.56) / 0.44, (y - 0.68) / 0.36)) ** 1.4;
  const k = 1 - cast * 0.45;
  return [(BG[0] + 34 * glow) * k, (BG[1] + 28 * glow) * k, (BG[2] + 38 * glow) * k, 1];
}

/**
 * Colour at one sample point, in a unit square.
 *
 * The maskable variant differs only in losing the rounded corners. Its safe
 * zone is the middle 80% as a circle - radius 0.4 - and the furthest thing here
 * from the middle is the bottom of the shell at 0.315, so the mark already sits
 * inside it and does not need shrinking to get there.
 */
function sample(x, y, { maskable }) {
  if (!maskable && !insideRoundedSquare(x, y, 0.22)) return [0, 0, 0, 0];

  let colour = ground(x, y);

  const shadow = crease(x, y);
  const lit = (normal, material, options) =>
    normal ? dim(surface(material, normal, options), shadow) : null;
  const put = (paint) => {
    if (paint) colour = blend(colour, paint);
  };
  const skin = { gloss: 0.4, tight: 24, rim: 0.4 };

  if (wisp(x, y, ...WISP)) colour = blend(colour, FLUFF);

  const head = ballNormal(x, y, ...HEAD);
  put(lit(head, CHICK, skin));

  if (head) {
    for (const [bx, by] of BLUSH_AT) {
      const k = Math.max(0, 1 - Math.hypot(x - bx, y - by) / 0.052) ** 1.7 * 0.34;
      if (k > 0) colour = blend(colour, BLUSH, k);
    }
  }

  put(lit(beakNormal(x, y, ...BEAK_AT), BEAK, { pivot: 0.45, gloss: 0.3, tight: 20 }));

  for (const [ex, ey] of EYES) {
    if (circle(x, y, ex, ey, EYE_R)) colour = blend(colour, EYE);
    // A dull bounce low right and a soft catchlight high left. Two dots, awake.
    if (circle(x, y, ex + EYE_R * 0.3, ey + EYE_R * 0.34, EYE_R * 0.28)) {
      colour = blend(colour, [118, 96, 92], 0.6);
    }
    if (circle(x, y, ex - EYE_R * 0.32, ey - EYE_R * 0.34, EYE_R * 0.32)) {
      colour = blend(colour, [255, 255, 255], 0.88);
    }
  }

  const rim = torn(x, ...RIM);
  const shell = eggNormal(x, y, 0.5, 0.56, 0.255, 0.28, 0.25);
  if (shell && y >= rim) {
    // The rim rolls away from us, so it darkens just under the broken edge.
    const roll = Math.max(0, 1 - (y - rim) / 0.038) * 0.26;
    colour = blend(colour, dim(surface(SHELL, shell, { gloss: 0.28, rim: 0.28 }), roll));
  }

  // Over the shell, since the tips lap across the rim, but rooted under the head.
  for (const wing of WINGS) put(lit(wingNormal(x, y, ...wing), WING, skin));

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

/* ------------------------------------------------------- the same, as SVG */

/*
 * The favicon is the tab icon and the header logo, so it wants to be a vector,
 * but it is the same bird and must stay the same bird. Everything below is
 * derived from the figures above rather than typed out again, so the drawing
 * cannot quietly drift away from the PNGs.
 */

const VIEW = 512;
const n = (value) => String(Math.round(value * 10) / 10);
const hex = ([r, g, b]) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/**
 * The shell as an ellipse. Only the part below the rim is ever drawn, and the
 * egg's taper lives entirely above its middle, so across almost all of what
 * shows this is exact; at the two top corners it is about a pixel wide.
 */
function shellPath() {
  const [cx, cy, rx, ry] = [0.5 * VIEW, 0.56 * VIEW, 0.255 * VIEW, 0.25 * VIEW];
  const rimAt = (X) => torn(X / VIEW, ...RIM) * VIEW;
  const topAt = (X) => cy - ry * Math.sqrt(Math.max(0, 1 - ((X - cx) / rx) ** 2));

  /** Where the torn rim first cuts the ellipse, walking in from one side. */
  const meeting = (from, to) => {
    const steps = 40000;
    for (let i = 0; i <= steps; i += 1) {
      const X = from + ((to - from) * i) / steps;
      if (Math.abs(X - cx) <= rx && topAt(X) < rimAt(X)) return X;
    }
    throw new Error("the rim never meets the shell");
  };

  const left = meeting(cx - rx, cx);
  const right = meeting(cx + rx, cx);

  // The teeth are where the triangle wave turns, which is every half period.
  const turns = [];
  for (let k = -2; k < 24; k += 1) {
    const X = ((k / 2 - RIM[3]) / RIM[2]) * VIEW;
    if (X > left && X < right) turns.push(X);
  }

  const along = [left, ...turns, right].map((X) => `${n(X)} ${n(rimAt(X))}`);
  // Along the rim left to right, then the long way round the bottom and back.
  return `M${along.join(" L")} A${n(rx)} ${n(ry)} 0 1 1 ${n(left)} ${n(rimAt(left))} Z`;
}

/**
 * A wing is the hull of two circles, drawn as those circles plus the slab
 * between them. Three shapes sharing one gradient look like one shape, and it
 * avoids having to reason about which way round an arc flag goes.
 */
function wingShapes([ax, ay, bx, by, r0, r1]) {
  const [x0, y0, x1, y1] = [ax * VIEW, ay * VIEW, bx * VIEW, by * VIEW];
  const [R0, R1] = [r0 * VIEW, r1 * VIEW];
  const phi = Math.atan2(y1 - y0, x1 - x0);
  const side = (cx, cy, r, which) =>
    `${n(cx + r * Math.cos(phi + (which * Math.PI) / 2))} ` +
    `${n(cy + r * Math.sin(phi + (which * Math.PI) / 2))}`;
  return [
    `<circle cx="${n(x0)}" cy="${n(y0)}" r="${n(R0)}" />`,
    `<circle cx="${n(x1)}" cy="${n(y1)}" r="${n(R1)}" />`,
    `<polygon points="${side(x0, y0, R0, 1)} ${side(x1, y1, R1, 1)} ` +
      `${side(x1, y1, R1, -1)} ${side(x0, y0, R0, -1)}" />`,
  ].join("\n    ");
}

/** The tuft, as the arc through the three points the rasteriser walks. */
function wispPath() {
  const [cx, cy, scale] = WISP;
  const at = (t) => {
    const angle = Math.PI * (1.05 - 0.95 * t);
    const reach = scale * (0.34 - 0.13 * t);
    return [
      (cx + Math.cos(angle) * reach) * VIEW,
      (cy - Math.sin(angle) * reach * 0.85) * VIEW,
    ];
  };
  const [[sx, sy], [mx, my], [ex, ey]] = [at(0), at(0.5), at(1)];
  const control = [2 * mx - (sx + ex) / 2, 2 * my - (sy + ey) / 2];
  return {
    d: `M${n(sx)} ${n(sy)} Q${n(control[0])} ${n(control[1])} ${n(ex)} ${n(ey)}`,
    width: 2 * scale * 0.0975 * VIEW,
  };
}

export function renderFavicon() {
  const [hx, hy, hr] = HEAD.map((v) => v * VIEW);
  const [bx, by, brx, bry] = BEAK_AT.map((v) => v * VIEW);
  const eyeR = EYE_R * VIEW;
  const tuft = wispPath();

  const eye = ([x, y]) => {
    const [ex, ey] = [x * VIEW, y * VIEW];
    return (
      `<circle cx="${n(ex)}" cy="${n(ey)}" r="${n(eyeR)}" fill="${hex(EYE)}" />\n    ` +
      `<circle cx="${n(ex + eyeR * 0.3)}" cy="${n(ey + eyeR * 0.34)}" ` +
      `r="${n(eyeR * 0.28)}" fill="#76605c" />\n    ` +
      `<circle cx="${n(ex - eyeR * 0.32)}" cy="${n(ey - eyeR * 0.34)}" ` +
      `r="${n(eyeR * 0.32)}" fill="#ffffff" opacity="0.88" />`
    );
  };

  const cheek = ([x, y], id) =>
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
    `cx="${n(x * VIEW)}" cy="${n(y * VIEW)}" r="27">\n` +
    `      <stop offset="0" stop-color="${hex(BLUSH)}" stop-opacity="0.34" />\n` +
    `      <stop offset="1" stop-color="${hex(BLUSH)}" stop-opacity="0" />\n` +
    `    </radialGradient>`;

  // The light sits where the rasteriser's does: up and to the left of centre.
  const towardsLight = (cx, cy, r) => [cx - 0.42 * r * 0.75, cy - 0.62 * r * 0.75];
  const [chickLx, chickLy] = towardsLight(hx, hy, hr);
  const [shellLx, shellLy] = towardsLight(0.5 * VIEW, 0.56 * VIEW, 0.255 * VIEW);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" role="img" aria-label="Stork">
  <!-- Generated by scripts/icon.mjs from the same figures it rasterises.
       Transparent behind, so the same mark sits on the header in either theme;
       the PNGs in the manifest add the dark square and this does not need it. -->
  <defs>
    <!-- All in user space, so one light governs every part of the drawing
         rather than each shape being lit inside its own bounding box. -->
    <radialGradient id="chick" gradientUnits="userSpaceOnUse" cx="${n(chickLx)}" cy="${n(chickLy)}" r="${n(hr * 1.36)}">
      <stop offset="0" stop-color="${hex(CHICK[2])}" />
      <stop offset="0.42" stop-color="${hex(CHICK[1])}" />
      <stop offset="1" stop-color="${hex(CHICK[0])}" />
    </radialGradient>
    <radialGradient id="shell" gradientUnits="userSpaceOnUse" cx="${n(shellLx)}" cy="${n(shellLy)}" r="${n(0.255 * VIEW * 1.35)}">
      <stop offset="0" stop-color="${hex(SHELL[2])}" />
      <stop offset="0.4" stop-color="${hex(SHELL[1])}" />
      <stop offset="1" stop-color="${hex(SHELL[0])}" />
    </radialGradient>
    <!-- Weighted early, so only the near corner of the near wing catches the
         bright tone. Spread evenly they come out as pale as the head and stop
         reading as separate things. -->
    <linearGradient id="wing" gradientUnits="userSpaceOnUse" x1="150" y1="205" x2="362" y2="302">
      <stop offset="0" stop-color="${hex(WING[2])}" />
      <stop offset="0.22" stop-color="${hex(WING[1])}" />
      <stop offset="0.9" stop-color="${hex(WING[0])}" />
    </linearGradient>
    <linearGradient id="beak" gradientUnits="userSpaceOnUse" x1="${n(bx - brx)}" y1="${n(by - bry)}" x2="${n(bx + brx)}" y2="${n(by + bry)}">
      <stop offset="0" stop-color="${hex(BEAK[2])}" />
      <stop offset="0.45" stop-color="${hex(BEAK[1])}" />
      <stop offset="1" stop-color="${hex(BEAK[0])}" />
    </linearGradient>
    ${cheek(BLUSH_AT[0], "cheekL")}
    ${cheek(BLUSH_AT[1], "cheekR")}
  </defs>

  <!-- Behind the head, so only the hook of it shows over the top. -->
  <path d="${tuft.d}" fill="none" stroke="${hex(FLUFF)}" stroke-width="${n(tuft.width)}" stroke-linecap="round" />

  <circle cx="${n(hx)}" cy="${n(hy)}" r="${n(hr)}" fill="url(#chick)" />
  <circle cx="${n(BLUSH_AT[0][0] * VIEW)}" cy="${n(BLUSH_AT[0][1] * VIEW)}" r="27" fill="url(#cheekL)" />
  <circle cx="${n(BLUSH_AT[1][0] * VIEW)}" cy="${n(BLUSH_AT[1][1] * VIEW)}" r="27" fill="url(#cheekR)" />
  <polygon points="${n(bx)} ${n(by - bry)} ${n(bx + brx)} ${n(by)} ${n(bx)} ${n(by + bry)} ${n(bx - brx)} ${n(by)}" fill="url(#beak)" />
  <g>
    ${EYES.map(eye).join("\n    ")}
  </g>

  <!-- Over the head's lower half, with a rim it tore rather than one it was cut
       to. The stroke is what keeps a cream shell visible on a white tab bar. -->
  <path d="${shellPath()}" fill="url(#shell)" stroke="${hex(SHELL[0])}" stroke-width="6" stroke-linejoin="round" />

  <!-- Lapped over the rim but rooted under the head, which is why they read as
       wings rather than as two things resting on the shell. -->
  <g fill="url(#wing)">
    ${WINGS.map(wingShapes).join("\n    ")}
  </g>
</svg>
`;
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

export function encodePng(width, height, rgba) {
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
