/**
 * Ricomprime le foto in gallery.json usando i file sorgente quando disponibili.
 * Uso: npm run optimize
 */

const fs = require("fs");
const path = require("path");
const { getExportSettings, exportPhotoFiles } = require("./export-utils");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const SETTINGS = getExportSettings(CONFIG);
const GALLERY_PATH = path.join(ROOT, "public", "data", "gallery.json");
const PUBLIC = path.join(ROOT, "public");
const OUT = {
  photos: path.join(PUBLIC, "photos"),
  thumbs: path.join(PUBLIC, "thumbs"),
  originals: path.join(PUBLIC, "originals"),
};
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

function fmt(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXT.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function buildSourceIndex(sourceFolder) {
  const index = new Map();
  for (const file of walk(sourceFolder)) {
    const key = path.basename(file, path.extname(file)).toLowerCase();
    if (!index.has(key)) index.set(key, file);
  }
  return index;
}

function resolveSource(photo, sourceIndex) {
  const keys = [
    photo.title?.replace(/\s+/g, ""),
    photo.id?.replace(/^\d+-/, ""),
  ].filter(Boolean);

  for (const key of keys) {
    const hit = sourceIndex.get(key.toLowerCase());
    if (hit) return hit;
  }

  const fallback = path.join(PUBLIC, photo.original);
  return fs.existsSync(fallback) ? fallback : null;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(GALLERY_PATH, "utf8"));
  const photos = data.photos || [];
  if (!photos.length) {
    console.error("Nessuna foto in gallery.json");
    process.exit(1);
  }

  const sourceIndex = CONFIG.sourceFolder ? buildSourceIndex(CONFIG.sourceFolder) : new Map();
  const origLabel =
    SETTINGS.origMax > 0
      ? `max ${SETTINGS.origMax}px, JPEG ${SETTINGS.origQ}`
      : `risoluzione piena, JPEG ${SETTINGS.origQ}`;

  console.log(`Ottimizzazione di ${photos.length} foto…`);
  console.log(`  Web: max ${SETTINGS.webMax}px, quality ${SETTINGS.webQ}`);
  console.log(`  Originali stampa: ${origLabel}`);

  let before = 0;
  let after = 0;
  const updated = [];

  for (const photo of photos) {
    for (const key of ["web", "thumb", "original"]) {
      const p = path.join(PUBLIC, photo[key]);
      if (fs.existsSync(p)) before += fs.statSync(p).size;
    }

    const sourcePath = resolveSource(photo, sourceIndex);
    if (!sourcePath) {
      console.warn(`  Salto (sorgente mancante): ${photo.title}`);
      updated.push(photo);
      continue;
    }

    const fromSource = sourceIndex.has(photo.title?.replace(/\s+/g, "").toLowerCase());
    process.stdout.write(`  ${photo.title}… `);
    const next = await exportPhotoFiles(sourcePath, OUT, photo.id, SETTINGS);
    console.log(fromSource ? "ok (da sorgente)" : "ok");

    for (const key of ["web", "thumb", "original"]) {
      const p = path.join(PUBLIC, next[key]);
      if (fs.existsSync(p)) after += fs.statSync(p).size;
    }

    updated.push(next);
  }

  fs.writeFileSync(
    GALLERY_PATH,
    JSON.stringify({ updated: new Date().toISOString(), photos: updated }, null, 2)
  );

  console.log(`\nPrima:  ${fmt(before)}`);
  console.log(`Dopo:   ${fmt(after)}`);
  if (before > after) {
    console.log(`Risparmio: ${fmt(before - after)} (${Math.round((1 - after / before) * 100)}%)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
