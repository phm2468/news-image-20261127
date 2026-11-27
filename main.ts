// News image 20261127 — "Sum up 27 November's world news in one image".
// A deterministic drawing program: it paints a 1024x1024 newspaper front
// page (masthead, one lead panel, two mid panels, three small panels and a
// banner) using only vector shapes and its own 5x7 pixel font, then encodes
// the result as a PNG with a hand-rolled encoder. Node standard library
// only, no network, no clocks, no Math.random: two runs write the same
// bytes. Output: $MAKEFUN_OUTPUT_DIR/entry.png (default /output).

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const fb = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const C = (hex: number): RGB => [
  (hex >> 16) & 255,
  (hex >> 8) & 255,
  hex & 255,
];

const PAPER = C(0xdcd8ce);
const INK = C(0x191a1c);
const WHITE = C(0xf4f2ea);
const CAPTION_BG = C(0x14181d);
const STORM_DEEP = C(0x16283c);
const STORM_MID = C(0x2e4a63);
const STORM_TOP = C(0x22364d);
const ALERT = C(0xe2481e);
const AMBER = C(0xf2a41f);
const PALE = C(0xb9c8d2);
const BOARD_BG = C(0x0b0e12);
const SEA = C(0x2c4653);
const NIGHT = C(0x141e29);
const GOLD = C(0xd9a441);
const ASH = C(0x8d8d94);
const LAVA = C(0xff5a1f);
const GREEN = C(0x4a7a4f);
const SPACE_BG = C(0x0d1420);
const SILVER = C(0xb9c1c9);

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}

function blendPx(x: number, y: number, c: RGB, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 3;
  fb[i] = Math.round(fb[i] * (1 - a) + c[0] * a);
  fb[i + 1] = Math.round(fb[i + 1] * (1 - a) + c[1] * a);
  fb[i + 2] = Math.round(fb[i + 2] * (1 - a) + c[2] * a);
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  for (let yy = y0; yy < y1; yy++)
    for (let xx = x0; xx < x1; xx++) setPx(xx, yy, c);
}

function blendRect(x: number, y: number, w: number, h: number, c: RGB, a: number): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  for (let yy = y0; yy < y1; yy++)
    for (let xx = x0; xx < x1; xx++) blendPx(xx, yy, c, a);
}

function disc(cx: number, cy: number, r: number, c: RGB, a = 1): void {
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) {
        if (a >= 1) setPx(xx, yy, c);
        else blendPx(xx, yy, c, a);
      }
    }
}

function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const dx = (xx - cx) / rx;
      const dy = (yy - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        if (a >= 1) setPx(xx, yy, c);
        else blendPx(xx, yy, c, a);
      }
    }
}

// Scanline polygon fill; pts are [x, y] pairs.
function poly(pts: number[][], c: RGB, a = 1): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H - 1, Math.ceil(maxY));
  const n = pts.length;
  for (let yy = y0; yy <= y1; yy++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      if (p1[1] === p2[1]) continue;
      const lo = Math.min(p1[1], p2[1]);
      const hi = Math.max(p1[1], p2[1]);
      if (yy >= lo && yy < hi) {
        xs.push(p1[0] + ((yy - p1[1]) / (p2[1] - p1[1])) * (p2[0] - p1[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.round(xs[i]);
      const xb = Math.round(xs[i + 1]);
      for (let xx = xa; xx <= xb; xx++) {
        if (a >= 1) setPx(xx, yy, c);
        else blendPx(xx, yy, c, a);
      }
    }
  }
}

// Thick line: stamp discs along the segment.
function line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, a = 1): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, c, a);
  }
}

// Deterministic pseudo-random source (fixed seed; no Math.random).
let seed = 987654321;
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// ------------------------------------------------------------------ font
// A 5x7 pixel font, rows top to bottom, bit 4 = leftmost column.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x0a, 0x04, 0x04, 0x04, 0x0a, 0x11],
  Y: [0x11, 0x0a, 0x04, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "~": [0, 0, 0x05, 0x0a, 0x14, 0, 0],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "%": [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
};

// Advance width of one character, in the same units as the size s.
function charAdvance(ch: string, s: number): number {
  if (ch === "—") return 9 * s;
  if (ch === "•" || ch === "·") return 4 * s;
  return 6 * s;
}

function textWidth(text: string, s: number, ls = 0): number {
  const t = text.toUpperCase();
  let w = 0;
  for (const ch of t) w += charAdvance(ch, s) + ls;
  return t.length ? w - ls : 0;
}

interface TextOpts {
  bold?: boolean;
  ls?: number;
  align?: "left" | "center" | "right";
}

// Draw text with its cap-height box top at y. x is the left edge, or the
// centre / right edge when align says so.
function drawText(text: string, x: number, y: number, s: number, c: RGB, opts: TextOpts = {}): void {
  const t = text.toUpperCase();
  const ls = opts.ls ?? 0;
  let cx = x;
  if (opts.align === "center") cx = x - textWidth(t, s, ls) / 2;
  if (opts.align === "right") cx = x - textWidth(t, s, ls);
  for (const ch of t) {
    if (ch === "—") {
      rect(cx + 0.4 * s, y + 3 * s, 8.2 * s, 1.15 * s, c);
      if (opts.bold) rect(cx + 0.4 * s, y + 3 * s + 0.9 * s, 8.2 * s, 0.8 * s, c);
    } else if (ch === "•" || ch === "·") {
      disc(cx + 2 * s, y + 3.5 * s, 1.05 * s, c);
    } else {
      const glyph = FONT[ch] ?? FONT["?"];
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            rect(cx + col * s, y + row * s, s, s, c);
            if (opts.bold) rect(cx + col * s + 0.45 * s, y + row * s, s, s, c);
          }
        }
      }
    }
    cx += charAdvance(ch, s) + ls;
  }
}

// ------------------------------------------------------------- page frame
function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    fb[i * 3] = c[0];
    fb[i * 3 + 1] = c[1];
    fb[i * 3 + 2] = c[2];
  }
}

function panelFrame(x: number, y: number, w: number, h: number): void {
  rect(x - 3, y - 3, w + 6, h + 6, INK);
}

function captionBar(x: number, y: number, w: number, h: number, text: string, s: number): void {
  rect(x, y, w, h, CAPTION_BG);
  drawText(text, x + w / 2, y + (h - 7 * s) / 2, s, WHITE, { bold: true, align: "center" });
}

// The small panels share one caption shape: a 48px bar, white headline
// line over an amber detail line.
function twoLineCaption(x: number, y: number, w: number, line1: string, line2: string): void {
  rect(x, y, w, 48, CAPTION_BG);
  drawText(line1, x + w / 2, y + 5, 2, WHITE, { bold: true, align: "center" });
  drawText(line2, x + w / 2, y + 26, 2, AMBER, { bold: true, align: "center" });
}

function kicker(x: number, y: number, text: string): void {
  const w = textWidth(text, 2, 1) + 16;
  rect(x, y, w, 24, INK);
  drawText(text, x + 8, y + 5, 2, AMBER, { bold: true, ls: 1 });
}

// -------------------------------------------------------------- masthead
function masthead(): void {
  drawText("LATE EDITION", 24, 30, 2, C(0x55534c), { bold: true, ls: 1 });
  drawText("ONE DAY · ONE IMAGE", 1000, 30, 2, C(0x55534c), { bold: true, ls: 1, align: "right" });
  rect(20, 52, 984, 3, INK);
  drawText("THE WORLD IN ONE PICTURE", 512, 66, 6, INK, { bold: true, ls: 2, align: "center" });
  drawText("FRIDAY 27 NOVEMBER 2026", 512, 122, 4, ALERT, { bold: true, ls: 5, align: "center" });
  rect(20, 146, 984, 2, INK);
  rect(20, 151, 984, 5, INK);
}

// ---------------------------------------------------------- storm (lead)
function stormPanel(): void {
  const x = 20;
  const y = 168;
  const w = 984;
  const h = 376;
  panelFrame(x, y, w, h);
  // Sky: storm-blue bands, darker at the top.
  const bands = 12;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const c: RGB = [
      Math.round(STORM_TOP[0] + (STORM_MID[0] - STORM_TOP[0]) * t),
      Math.round(STORM_TOP[1] + (STORM_MID[1] - STORM_TOP[1]) * t),
      Math.round(STORM_TOP[2] + (STORM_MID[2] - STORM_TOP[2]) * t),
    ];
    rect(x, y + (i * (h - 36)) / bands, w, (h - 36) / bands + 1, c);
  }
  // Clouds.
  ellipse(x + 180, y + 66, 150, 26, STORM_DEEP, 0.55);
  ellipse(x + 560, y + 44, 190, 22, STORM_DEEP, 0.45);
  ellipse(x + 880, y + 84, 130, 20, STORM_DEEP, 0.5);
  // Snow streaks.
  for (let i = 0; i < 260; i++) {
    const sx = x + rnd() * w;
    const sy = y + rnd() * (h - 60);
    line(sx, sy, sx - 7, sy + 5, 1.6, WHITE, 0.75);
  }
  // Headline.
  drawText("STORM GROUNDS", x + 24, y + 18, 7, WHITE, { bold: true, ls: 2 });
  drawText("THANKSGIVING", x + 24, y + 76, 7, WHITE, { bold: true, ls: 2 });
  kicker(x + w - 208, y + 14, "UNITED STATES");
  // Departure board.
  const bx = x + 596;
  const by = y + 92;
  const bw = 364;
  const bh = 176;
  rect(bx - 3, by - 3, bw + 6, bh + 6, INK);
  rect(bx, by, bw, bh, BOARD_BG);
  drawText("DEPARTURES", bx + 14, by + 10, 3, AMBER, { bold: true, ls: 2 });
  drawText("TERMINAL 3", bx + bw - 14, by + 12, 2, PALE, { align: "right" });
  const rows: Array<[string, string]> = [
    ["CHI AA231 08:40", "CANCELLED"],
    ["NYC UA908 09:15", "CANCELLED"],
    ["ATL DL447 10:05", "CANCELLED"],
    ["DEN WN663 11:30", "CANCELLED"],
    ["BOS B6518 12:20", "CANCELLED"],
  ];
  rows.forEach((r, i) => {
    const ry = by + 46 + i * 26;
    drawText(r[0], bx + 14, ry, 2, PALE, {});
    drawText(r[1], bx + bw - 14, ry, 2, ALERT, { bold: true, align: "right" });
  });
  // Horizon houses (dark, one lit window) behind the plane.
  const hy = y + h - 36 - 58;
  const house = (hx: number, hw: number, hh: number, lit: boolean) => {
    rect(hx, hy + 40 - hh, hw, hh, STORM_DEEP);
    poly(
      [
        [hx - 5, hy + 40 - hh],
        [hx + hw / 2, hy + 40 - hh - 18],
        [hx + hw + 5, hy + 40 - hh],
      ],
      STORM_DEEP,
    );
    rect(hx - 5, hy + 40 - hh - 4, hw + 10, 5, WHITE);
    if (lit) rect(hx + hw / 2 - 4, hy + 40 - hh + 12, 8, 10, AMBER);
    else rect(hx + hw / 2 - 4, hy + 40 - hh + 12, 8, 10, C(0x0d1622));
  };
  house(x + 26, 64, 34, false);
  house(x + 104, 52, 28, true);
  // Grounded airliner, side view facing right.
  const gy = y + h - 36 - 26; // runway top
  rect(x, gy + 18, w, 4, C(0x0e1a28));
  for (let dx = 10; dx < w; dx += 46) rect(x + dx, gy + 19, 22, 2, PALE);
  const plane = STORM_DEEP;
  poly(
    [
      [x + 150, gy - 62],
      [x + 420, gy - 62],
      [x + 486, gy - 44],
      [x + 492, gy - 30],
      [x + 470, gy - 16],
      [x + 190, gy - 14],
      [x + 150, gy - 26],
    ],
    plane,
  );
  // Tail fin and wing.
  poly(
    [
      [x + 158, gy - 60],
      [x + 196, gy - 60],
      [x + 214, gy - 108],
      [x + 184, gy - 108],
    ],
    plane,
  );
  poly(
    [
      [x + 268, gy - 20],
      [x + 384, gy - 20],
      [x + 348, gy + 4],
      [x + 238, gy + 2],
    ],
    plane,
  );
  rect(x + 292, gy - 12, 30, 12, plane);
  // Snow cap on fuselage and wing.
  poly(
    [
      [x + 160, gy - 62],
      [x + 420, gy - 62],
      [x + 452, gy - 52],
      [x + 200, gy - 54],
    ],
    WHITE,
  );
  // Windows.
  for (let i = 0; i < 11; i++) disc(x + 216 + i * 22, gy - 44, 3, PALE);
  disc(x + 470, gy - 40, 3.4, PALE);
  // Gear and wheels.
  line(x + 220, gy - 14, x + 220, gy + 14, 4, plane);
  line(x + 420, gy - 14, x + 420, gy + 14, 4, plane);
  disc(x + 220, gy + 16, 7, C(0x0a141f));
  disc(x + 420, gy + 16, 7, C(0x0a141f));
  // Snow ground.
  rect(x, gy + 22, w, h - 36 - (gy + 22 - y), C(0xcdd6dd));
  for (let i = 0; i < 40; i++) {
    const sx = x + rnd() * w;
    const sy = gy + 26 + rnd() * 8;
    disc(sx, sy, 2, WHITE, 0.8);
  }
  captionBar(x, y + h - 36, w, 36, "~400 FLIGHTS CANCELLED, 724,000 WITHOUT POWER", 3);
}

// --------------------------------------------------------------- Hormuz
function hormuzPanel(): void {
  const x = 20;
  const y = 560;
  const w = 480;
  const h = 232;
  const sceneH = h - 34;
  panelFrame(x, y, w, h);
  // Dusk sky bands.
  const skyTop = C(0x4a3a38);
  const skyBot = C(0x9a6242);
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const c: RGB = [
      Math.round(skyTop[0] + (skyBot[0] - skyTop[0]) * t),
      Math.round(skyTop[1] + (skyBot[1] - skyTop[1]) * t),
      Math.round(skyTop[2] + (skyBot[2] - skyTop[2]) * t),
    ];
    rect(x, y + (i * sceneH * 0.55) / bands, w, (sceneH * 0.55) / bands + 1, c);
  }
  // Sea.
  rect(x, y + sceneH * 0.55, w, sceneH * 0.45, SEA);
  for (let i = 0; i < 26; i++) {
    const wx = x + rnd() * (w - 40);
    const wy = y + sceneH * 0.6 + rnd() * sceneH * 0.34;
    line(wx, wy, wx + 16 + rnd() * 14, wy, 1.6, PALE, 0.5);
  }
  // Headlands closing the strait.
  poly(
    [
      [x, y + 30],
      [x + 92, y + 66],
      [x + 70, y + sceneH],
      [x, y + sceneH],
    ],
    C(0x2a2320),
  );
  poly(
    [
      [x + w, y + 18],
      [x + w - 104, y + 58],
      [x + w - 76, y + sceneH],
      [x + w, y + sceneH],
    ],
    C(0x2a2320),
  );
  // Price board.
  const px = x + w - 132;
  const py = y + 10;
  rect(px - 2, py - 2, 124, 62, INK);
  rect(px, py, 120, 58, BOARD_BG);
  drawText("BRENT", px + 60, py + 6, 2, PALE, { align: "center" });
  drawText("$97", px + 60, py + 24, 4, AMBER, { bold: true, align: "center" });
  // Tanker: hull, deck houses, tanks, bridge.
  const wy = y + sceneH - 34;
  const ship = C(0x14100e);
  poly(
    [
      [x + 108, wy - 26],
      [x + 372, wy - 26],
      [x + 396, wy - 6],
      [x + 384, wy + 8],
      [x + 128, wy + 8],
      [x + 100, wy - 8],
    ],
    ship,
  );
  rect(x + 108, wy - 34, 264, 9, ship);
  rect(x + 118, wy - 58, 40, 26, ship);
  rect(x + 126, wy - 70, 10, 14, ship);
  for (let i = 0; i < 4; i++) ellipse(x + 196 + i * 44, wy - 38, 19, 9, ship);
  line(x + 356, wy - 34, x + 356, wy - 66, 3, ship);
  // Fire and smoke amidships.
  disc(x + 238, wy - 40, 13, LAVA);
  disc(x + 252, wy - 44, 9, AMBER);
  disc(x + 226, wy - 44, 8, ALERT);
  const smoke: Array<[number, number, number]> = [
    [250, -64, 12],
    [260, -84, 16],
    [258, -104, 20],
    [270, -122, 24],
    [286, -136, 27],
  ];
  for (const [sx, sy, r] of smoke) disc(x + sx, wy + sy, r, ASH, 0.85);
  // Headline last, with a dark shadow, so it stays legible over the smoke.
  drawText("TANKERS HIT IN", x + 18, y + 14, 3, INK, { bold: true, ls: 1 });
  drawText("STRAIT OF HORMUZ", x + 18, y + 40, 3, INK, { bold: true, ls: 1 });
  drawText("TANKERS HIT IN", x + 16, y + 12, 3, WHITE, { bold: true, ls: 1 });
  drawText("STRAIT OF HORMUZ", x + 16, y + 38, 3, WHITE, { bold: true, ls: 1 });
  captionBar(x, y + sceneH, w, 34, "BRENT CRUDE JUMPS TO $97 A BARREL", 2);
}

// --------------------------------------------------------------- Ukraine
function ukrainePanel(): void {
  const x = 524;
  const y = 560;
  const w = 480;
  const h = 232;
  const sceneH = h - 34;
  panelFrame(x, y, w, h);
  rect(x, y, w, sceneH, NIGHT);
  // Stars.
  for (let i = 0; i < 46; i++) {
    disc(x + rnd() * w, y + rnd() * sceneH * 0.5, 1.3, WHITE, 0.8);
  }
  // Moon.
  disc(x + w - 52, y + 34, 15, C(0xe8e4d2));
  disc(x + w - 58, y + 30, 13, NIGHT);
  // Searchlight beams (drawn before the skyline bases).
  const beam = C(0xcfe4f2);
  poly(
    [
      [x + 66, y + sceneH],
      [x + 96, y + sceneH],
      [x + 300, y + 6],
      [x + 262, y + 6],
    ],
    beam,
    0.16,
  );
  poly(
    [
      [x + 392, y + sceneH],
      [x + 422, y + sceneH],
      [x + 210, y + 16],
      [x + 172, y + 16],
    ],
    beam,
    0.14,
  );
  poly(
    [
      [x + 226, y + sceneH],
      [x + 252, y + sceneH],
      [x + 330, y + 40],
      [x + 292, y + 40],
    ],
    beam,
    0.1,
  );
  // Headline.
  drawText("ZELENSKY WARNS OF", x + 16, y + 12, 3, WHITE, { bold: true, ls: 1 });
  drawText("NEW MASS STRIKE", x + 16, y + 38, 3, WHITE, { bold: true, ls: 1 });
  // Skyline.
  const base = y + sceneH;
  const block = (bx: number, bw: number, bh: number) => rect(x + bx, base - bh, bw, bh, C(0x0a0f16));
  block(0, 58, 64);
  block(52, 44, 88);
  block(150, 52, 56);
  block(258, 46, 78);
  block(352, 56, 62);
  block(428, 52, 92);
  // Golden dome on a church block, centre-left: the ellipse is drawn, then
  // the block front is redrawn over its lower half, leaving a dome cap.
  rect(x + 96, base - 74, 54, 74, C(0x0a0f16));
  ellipse(x + 123, base - 74, 24, 26, GOLD);
  rect(x + 96, base - 74, 54, 74, C(0x0a0f16));
  poly(
    [
      [x + 112, base - 96],
      [x + 134, base - 96],
      [x + 123, base - 118],
    ],
    GOLD,
  );
  line(x + 123, base - 118, x + 123, base - 128, 2.4, GOLD);
  line(x + 117, base - 124, x + 129, base - 124, 2.4, GOLD);
  // Second, smaller dome, capped the same way.
  rect(x + 306, base - 58, 40, 58, C(0x0a0f16));
  ellipse(x + 326, base - 58, 17, 18, GOLD);
  rect(x + 306, base - 58, 40, 58, C(0x0a0f16));
  // Lit windows.
  const winAt: Array<[number, number]> = [
    [66, 40],
    [80, 58],
    [160, 30],
    [176, 44],
    [268, 52],
    [368, 34],
    [442, 60],
    [452, 26],
    [30, 22],
  ];
  for (const [wx, wy] of winAt) rect(x + wx, base - wy, 5, 7, AMBER);
  // Searchlight sources.
  disc(x + 81, base - 2, 5, beam);
  disc(x + 407, base - 2, 5, beam);
  disc(x + 239, base - 2, 4, beam);
  captionBar(x, y + sceneH, w, 34, "AIR RAID ALERT OVER THE CAPITAL", 2);
}

// ----------------------------------------------------------------- Mayon
function mayonPanel(): void {
  const x = 20;
  const y = 808;
  const w = 314;
  const h = 132;
  const sceneH = h - 48;
  panelFrame(x, y, w, h);
  rect(x, y, w, sceneH, C(0x707880));
  ellipse(x + 60, y + 20, 70, 12, C(0x565e66), 0.6);
  ellipse(x + 250, y + 14, 80, 11, C(0x565e66), 0.5);
  // Ash column above the crater, kept inside the panel and spread wide.
  const cx = x + w / 2;
  disc(cx, y + 30, 11, ASH, 0.95);
  disc(cx - 11, y + 22, 14, ASH, 0.9);
  disc(cx + 12, y + 18, 16, ASH, 0.85);
  disc(cx + 1, y + 26, 19, ASH, 0.75);
  disc(cx - 24, y + 26, 10, ASH, 0.7);
  disc(cx + 27, y + 28, 11, ASH, 0.7);
  // Cone.
  poly(
    [
      [x + 26, y + sceneH],
      [cx - 13, y + 30],
      [cx + 13, y + 30],
      [x + w - 26, y + sceneH],
    ],
    C(0x3d3a38),
  );
  poly(
    [
      [cx - 13, y + 30],
      [cx + 13, y + 30],
      [cx + 5, y + 52],
      [cx - 5, y + 52],
    ],
    ASH,
  );
  // Lava at the crater and a trickle down the slope.
  disc(cx, y + 31, 5, LAVA);
  line(cx - 2, y + 34, cx - 12, y + 58, 3.4, LAVA);
  line(cx - 12, y + 58, cx - 9, y + 72, 2.6, AMBER);
  twoLineCaption(x, y + sceneH, w, "MAYON ERUPTS", "ASH 3,000 M");
}

// -------------------------------------------------------------- Colombia
function colombiaPanel(): void {
  const x = 355;
  const y = 808;
  const w = 314;
  const h = 132;
  const sceneH = h - 48;
  panelFrame(x, y, w, h);
  rect(x, y, w, sceneH, C(0xb9c6c9));
  disc(x + 42, y + 20, 13, AMBER);
  // Hills: discs centred inside the panel, so they cannot spill sideways.
  disc(x + 90, y + sceneH + 26, 62, GREEN);
  disc(x + 232, y + sceneH + 30, 66, C(0x3c6a41));
  rect(x, y + sceneH - 8, w, 8, C(0x3c6a41));
  // Two freed figures with raised arms.
  const person = (px: number, py: number) => {
    disc(px, py - 26, 6.5, INK);
    line(px, py - 20, px, py + 2, 5, INK);
    line(px, py - 16, px - 11, py - 30, 4, INK);
    line(px, py - 16, px + 11, py - 30, 4, INK);
    line(px, py + 2, px - 8, py + 18, 4.4, INK);
    line(px, py + 2, px + 8, py + 18, 4.4, INK);
  };
  person(x + 128, y + sceneH - 26);
  person(x + 178, y + sceneH - 26);
  // A dove above them: body, wing, tail.
  const dx = x + 232;
  const dy = y + 26;
  ellipse(dx, dy, 13, 6, WHITE);
  poly(
    [
      [dx - 4, dy - 3],
      [dx + 8, dy - 16],
      [dx + 12, dy - 2],
    ],
    WHITE,
  );
  poly(
    [
      [dx - 12, dy],
      [dx - 22, dy - 5],
      [dx - 20, dy + 4],
    ],
    WHITE,
  );
  disc(dx + 13, dy - 3, 3.6, WHITE);
  twoLineCaption(x, y + sceneH, w, "HOSTAGES FREED", "IN COLOMBIA");
}

// ---------------------------------------------------------------- SpaceX
function spacePanel(): void {
  const x = 690;
  const y = 808;
  const w = 314;
  const h = 132;
  const sceneH = h - 48;
  panelFrame(x, y, w, h);
  rect(x, y, w, sceneH, SPACE_BG);
  for (let i = 0; i < 34; i++) {
    disc(x + rnd() * w, y + rnd() * sceneH, 1.2, WHITE, 0.85);
  }
  // Earth arc, bottom-left corner, sized to stay inside the panel.
  disc(x + 44, y + sceneH + 12, 32, C(0x2a5a8a));
  disc(x + 44, y + sceneH + 12, 32, C(0x3a7ab5), 0.35);
  // Satellite: panel wings, body, dish.
  const cx = x + 168;
  const cy = y + 42;
  rect(cx - 118, cy - 13, 74, 26, C(0x33507a));
  rect(cx + 44, cy - 13, 74, 26, C(0x33507a));
  for (let i = 1; i < 4; i++) {
    line(cx - 118 + i * 18.5, cy - 13, cx - 118 + i * 18.5, cy + 13, 1.4, C(0x7fa6cc));
    line(cx + 44 + i * 18.5, cy - 13, cx + 44 + i * 18.5, cy + 13, 1.4, C(0x7fa6cc));
  }
  line(cx - 118, cy, cx + 118, cy, 1.4, C(0x7fa6cc));
  rect(cx - 44, cy - 4, 26, 8, SILVER);
  rect(cx + 18, cy - 4, 26, 8, SILVER);
  rect(cx - 17, cy - 15, 34, 30, SILVER);
  rect(cx - 17, cy - 15, 34, 6, C(0x8a939c));
  line(cx, cy + 15, cx - 8, cy + 27, 2.4, SILVER);
  ellipse(cx - 10, cy + 29, 9, 4.4, SILVER);
  twoLineCaption(x, y + sceneH, w, "SPACEX CLEARED FOR", "1M SATELLITES");
}

// ---------------------------------------------------------------- banner
function banner(): void {
  rect(20, 956, 984, 48, INK);
  drawText("STORM • STRAIT • STRIKE — ONE FRIDAY, THREE FRONTS", 512, 969, 3, C(0xff7a33), {
    bold: true,
    ls: 1,
    align: "center",
  });
  rect(20, 1010, 984, 3, INK);
}

// ------------------------------------------------------------ PNG encode
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(): Buffer {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let yy = 0; yy < H; yy++) {
    raw[yy * (W * 3 + 1)] = 0; // filter: none
    Buffer.from(fb.buffer, yy * W * 3, W * 3).copy(raw, yy * (W * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ main
function main(): void {
  fillAll(PAPER);
  rect(8, 8, W - 16, H - 16, PAPER);
  rect(8, 8, W - 16, 3, INK);
  rect(8, H - 11, W - 16, 3, INK);
  rect(8, 8, 3, H - 16, INK);
  rect(W - 11, 8, 3, H - 16, INK);
  masthead();
  stormPanel();
  hormuzPanel();
  ukrainePanel();
  mayonPanel();
  colombiaPanel();
  spacePanel();
  banner();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), encodePng());
}

main();
