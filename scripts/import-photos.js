/**
 * Importa foto da cartella reflex, seleziona le migliori, genera web + thumbs.
 * Uso: node scripts/import-photos.js "C:\percorso\foto"
 *      npm run import -- "C:\percorso\foto"
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { getExportSettings, exportPhotoFiles } = require("./export-utils");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

const sourceArg = process.argv[2] || CONFIG.sourceFolder;
if (!sourceArg || !fs.existsSync(sourceArg)) {
  console.error("Specifica la cartella foto:");
  console.error('  npm run import -- "C:\\Users\\...\\MieFoto"');
  process.exit(1);
}

const OUT = {
  photos: path.join(ROOT, "public", "photos"),
  thumbs: path.join(ROOT, "public", "thumbs"),
  originals: path.join(ROOT, "public", "originals"),
  data: path.join(ROOT, "public", "data", "gallery.json"),
};

for (const d of Object.values(OUT)) {
  if (d.endsWith(".json")) {
    fs.mkdirSync(path.dirname(d), { recursive: true });
    continue;
  }
  fs.mkdirSync(d, { recursive: true });
  fs.readdirSync(d).forEach((f) => fs.unlinkSync(path.join(d, f)));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXT.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

async function scoreImage(filePath) {
  const stat = fs.statSync(filePath);
  let meta;
  try {
    meta = await sharp(filePath).metadata();
  } catch {
    return null;
  }
  const pixels = (meta.width || 0) * (meta.height || 0);
  if (pixels < 400_000) return null; // troppo piccola

  let sharpness = 0;
  try {
    const { channels } = await sharp(filePath)
      .greyscale()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const n = channels.length;
    let sum = 0;
    for (let i = 1; i < n - 1; i++) sum += Math.abs(channels[i] - channels[i - 1]);
    sharpness = sum / n;
  } catch {
    sharpness = 0;
  }

  const megapixels = pixels / 1_000_000;
  const score = megapixels * 40 + sharpness * 0.15 + Math.log10(stat.size + 1) * 5;
  return { filePath, meta, score, size: stat.size };
}

function slug(name, i) {
  const base = path.basename(name, path.extname(name))
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40) || `foto-${i}`;
  return `${String(i).padStart(2, "0")}-${base}`;
}

async function exportPhoto(filePath, id) {
  return exportPhotoFiles(filePath, OUT, id, getExportSettings(CONFIG));
}

async function main() {
  console.log("Scansione:", sourceArg);
  const all = walk(sourceArg);
  console.log(`Trovate ${all.length} immagini.`);

  const scored = [];
  for (const f of all) {
    const s = await scoreImage(f);
    if (s) scored.push(s);
  }
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, CONFIG.maxGalleryPhotos);
  console.log(`Selezionate ${picked.length} migliori foto.`);

  const gallery = [];

  for (let i = 0; i < picked.length; i++) {
    const { filePath } = picked[i];
    const id = slug(filePath, i + 1);
    gallery.push(await exportPhoto(filePath, id));
  }

  fs.writeFileSync(OUT.data, JSON.stringify({ updated: new Date().toISOString(), photos: gallery }, null, 2));
  console.log("Gallery pronta in public/ — avvia con: npm run serve");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
