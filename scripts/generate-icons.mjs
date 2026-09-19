#!/usr/bin/env node
/**
 * Generates the PWA icons (PNG) and favicon.svg without any dependencies.
 * Run with `npm run icons`. The design: a yellow tile, a tilted white card
 * with a black frame and offset shadow, and a chunky pixel "Ä".
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const YELLOW = [255, 216, 77];
const YELLOW_DARK = [242, 183, 5];
const WHITE = [255, 253, 247];
const BLACK = [17, 17, 17];

// 5x8 pixel glyph "Ä"
const GLYPH = [
  '.X.X.',
  '.....',
  '..X..',
  '.X.X.',
  'X...X',
  'XXXXX',
  'X...X',
  'X...X',
];

// ───────────────────────────── scene (in a 100×100 unit space) ─────────────────────────────

const CARD = { cx: 48, cy: 50, w: 52, h: 68, r: 9, angle: -8, border: 3.2 };
const SHADOW_OFFSET = 6;
const CELL = 6;

/** Returns the scene as a list of shapes, painted in order. */
function buildScene(contentScale) {
  const s = contentScale;
  const scale = (v) => 50 + (v - 50) * s;
  const shapes = [];
  const card = { ...CARD, cx: scale(CARD.cx), cy: scale(CARD.cy), w: CARD.w * s, h: CARD.h * s, r: CARD.r * s };

  shapes.push({ kind: 'rrect', ...card, cx: card.cx + SHADOW_OFFSET * s, cy: card.cy + SHADOW_OFFSET * s, color: BLACK });
  shapes.push({ kind: 'rrect', ...card, color: BLACK });
  shapes.push({
    kind: 'rrect',
    ...card,
    w: card.w - CARD.border * 2 * s,
    h: card.h - CARD.border * 2 * s,
    r: Math.max(0, card.r - CARD.border * s),
    color: WHITE,
  });

  // Glyph cells, centred on the card, rotated with it.
  const cols = GLYPH[0].length;
  const rows = GLYPH.length;
  const cell = CELL * s;
  const originX = -(cols * cell) / 2;
  const originY = -(rows * cell) / 2;
  GLYPH.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== 'X') return;
      shapes.push({
        kind: 'rrect',
        cx: card.cx,
        cy: card.cy,
        angle: card.angle,
        // local offset of the cell centre inside the card
        ox: originX + (x + 0.5) * cell,
        oy: originY + (y + 0.5) * cell,
        w: cell + 1.2,
        h: cell + 1.2,
        r: 0,
        color: BLACK,
      });
    });
  });

  shapes.push({ kind: 'star', cx: scale(84), cy: scale(20), rOuter: 9 * s, rInner: 3.4 * s, color: BLACK });
  shapes.push({ kind: 'circle', cx: scale(16), cy: scale(86), r: 6.5 * s, color: BLACK });
  shapes.push({ kind: 'circle', cx: scale(16), cy: scale(86), r: 4.2 * s, color: YELLOW_DARK });
  return shapes;
}

// ───────────────────────────── rasterizer ─────────────────────────────

function toLocal(shape, px, py) {
  const a = ((shape.angle ?? 0) * Math.PI) / 180;
  const dx = px - shape.cx;
  const dy = py - shape.cy;
  const x = dx * Math.cos(-a) - dy * Math.sin(-a) - (shape.ox ?? 0);
  const y = dx * Math.sin(-a) + dy * Math.cos(-a) - (shape.oy ?? 0);
  return [x, y];
}

function inRoundedRect(shape, px, py) {
  const [x, y] = toLocal(shape, px, py);
  const hw = shape.w / 2;
  const hh = shape.h / 2;
  if (Math.abs(x) > hw || Math.abs(y) > hh) return false;
  const r = shape.r;
  const qx = Math.abs(x) - (hw - r);
  const qy = Math.abs(y) - (hh - r);
  if (qx <= 0 || qy <= 0) return true;
  return qx * qx + qy * qy <= r * r;
}

function starPolygon(shape) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? shape.rOuter : shape.rInner;
    pts.push([shape.cx + Math.cos(a) * r, shape.cy + Math.sin(a) * r]);
  }
  return pts;
}

function inPolygon(pts, px, py) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function hit(shape, px, py) {
  switch (shape.kind) {
    case 'rrect':
      return inRoundedRect(shape, px, py);
    case 'circle':
      return (px - shape.cx) ** 2 + (py - shape.cy) ** 2 <= shape.r ** 2;
    case 'star':
      return inPolygon(shape.points ?? (shape.points = starPolygon(shape)), px, py);
    default:
      return false;
  }
}

function render(size, contentScale) {
  const shapes = buildScene(contentScale);
  const SS = 4; // supersampling per axis
  const pixels = Buffer.alloc(size * size * 4);
  const unit = 100 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) * unit;
          const py = (y + (sy + 0.5) / SS) * unit;
          let color = YELLOW;
          for (const shape of shapes) if (hit(shape, px, py)) color = shape.color;
          r += color[0];
          g += color[1];
          b += color[2];
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      pixels[i] = Math.round(r / n);
      pixels[i + 1] = Math.round(g / n);
      pixels[i + 2] = Math.round(b / n);
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

// ───────────────────────────── PNG encoder ─────────────────────────────

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ───────────────────────────── SVG (favicon) ─────────────────────────────

function rgb([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}

function svg() {
  const parts = [];
  for (const shape of buildScene(1)) {
    if (shape.kind === 'rrect') {
      const x = -shape.w / 2 + (shape.ox ?? 0);
      const y = -shape.h / 2 + (shape.oy ?? 0);
      parts.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${shape.w.toFixed(2)}" height="${shape.h.toFixed(2)}" rx="${shape.r}" fill="${rgb(shape.color)}" transform="translate(${shape.cx} ${shape.cy}) rotate(${shape.angle ?? 0})"/>`,
      );
    } else if (shape.kind === 'circle') {
      parts.push(`<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" fill="${rgb(shape.color)}"/>`);
    } else if (shape.kind === 'star') {
      const points = starPolygon(shape)
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' ');
      parts.push(`<polygon points="${points}" fill="${rgb(shape.color)}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${rgb(YELLOW)}"/>${parts.join('')}</svg>\n`;
}

// ───────────────────────────── write files ─────────────────────────────

mkdirSync(join(OUT_DIR, 'icons'), { recursive: true });

const targets = [
  { file: 'icons/icon-192.png', size: 192, scale: 1 },
  { file: 'icons/icon-512.png', size: 512, scale: 1 },
  { file: 'icons/apple-touch-icon.png', size: 180, scale: 1 },
  // Maskable icons keep everything inside the central 80 % "safe zone".
  { file: 'icons/icon-maskable-512.png', size: 512, scale: 0.72 },
];

for (const target of targets) {
  const png = encodePng(target.size, render(target.size, target.scale));
  writeFileSync(join(OUT_DIR, target.file), png);
  console.log(`wrote public/${target.file} (${png.length} bytes)`);
}
writeFileSync(join(OUT_DIR, 'favicon.svg'), svg());
console.log('wrote public/favicon.svg');
