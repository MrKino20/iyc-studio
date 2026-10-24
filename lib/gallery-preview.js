const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const MAX_EDGE = 1600;
const FONT = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  Y: ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
};

function previewPath(original) {
  return original.replace(/\.[^.]+$/, ".preview.jpg");
}

function drawMark() {
  const phrase = "IYC STUDIO     ";
  const scale = 5;
  const gap = scale;
  const charW = 5 * scale + gap;
  const lineH = 7 * scale + scale * 6;
  const lines = 4;
  const width = phrase.length * charW;
  const height = lines * lineH;
  const data = Buffer.alloc(width * height * 4);
  const paint = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = (y * width + x) * 4;
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = a;
  };
  for (let line = 0; line < lines; line++) {
    const offset = line % 2 === 0 ? 0 : charW * 6;
    for (let ci = 0; ci < phrase.length; ci++) {
      const rows = FONT[phrase[ci]] || FONT[" "];
      for (let ry = 0; ry < 7; ry++) {
        for (let rx = 0; rx < 5; rx++) {
          if (rows[ry][rx] !== "1") continue;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const x = ci * charW + rx * scale + dx + offset;
              const y = line * lineH + ry * scale + dy;
              paint(x + 2, y + 2, 0, 0, 0, 150);
              paint(x, y, 255, 255, 255, 185);
            }
          }
        }
      }
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } })
    .rotate(-32, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

let markPromise = null;

function mark() {
  if (!markPromise) markPromise = drawMark();
  return markPromise;
}

async function writePreview(original, dest) {
  const resized = await sharp(original)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .toBuffer();
  const output = await sharp(resized)
    .composite([{ input: await mark(), tile: true, blend: "over" }])
    .jpeg({ quality: 68, mozjpeg: true })
    .toBuffer();
  fs.writeFileSync(dest, output);
  return output.length;
}

async function ensurePreview(original) {
  const dest = previewPath(original);
  if (!fs.existsSync(original)) return null;
  const sourceTime = fs.statSync(original).mtimeMs;
  if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= sourceTime) return dest;
  await writePreview(original, dest);
  return dest;
}

async function ensureGalleryPreviews(root, gallery) {
  for (const photo of gallery.photos || []) {
    if (!photo || !photo.id || !photo.ext) continue;
    const original = path.join(root, "private-galleries", gallery.id, photo.id + photo.ext);
    if (fs.existsSync(original)) await ensurePreview(original);
  }
}

module.exports = { previewPath, ensurePreview, ensureGalleryPreviews };
