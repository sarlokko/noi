/**
 * Ricostruisce public/ con solo le foto elencate in config.featuredPhotos,
 * nell'ordine indicato. Usa gli asset già esportati in gallery.json.
 *
 *   npm run gallery:featured
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const GALLERY_PATH = path.join(ROOT, "public", "data", "gallery.json");

function slug(name, i) {
  const base = name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").slice(0, 40) || `foto-${i}`;
  return `${String(i).padStart(2, "0")}-${base}`;
}

function normalizeTitle(name) {
  return path.basename(name, path.extname(name)).toUpperCase();
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function clearDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    fs.unlinkSync(path.join(dir, f));
  }
}

function main() {
  const featured = CONFIG.featuredPhotos;
  if (!featured?.length) {
    console.error("Aggiungi featuredPhotos in config.json");
    process.exit(1);
  }

  if (!fs.existsSync(GALLERY_PATH)) {
    console.error("gallery.json non trovato — esegui prima npm run import:update");
    process.exit(1);
  }

  const current = JSON.parse(fs.readFileSync(GALLERY_PATH, "utf8"));
  const byTitle = new Map(current.photos.map((p) => [normalizeTitle(p.title), p]));

  const missing = featured.filter((name) => !byTitle.has(normalizeTitle(name)));
  if (missing.length) {
    console.error("Foto non trovate in gallery.json:", missing.join(", "));
    process.exit(1);
  }

  const dirs = {
    photos: path.join(ROOT, "public", "photos"),
    thumbs: path.join(ROOT, "public", "thumbs"),
    originals: path.join(ROOT, "public", "originals"),
  };

  const staging = path.join(ROOT, "public", ".featured-staging");
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  const gallery = [];

  for (let i = 0; i < featured.length; i++) {
    const title = featured[i];
    const src = byTitle.get(normalizeTitle(title));
    const id = slug(title, i + 1);
    const webName = `${id}.webp`;
    const thumbName = `${id}-thumb.webp`;
    const originalName = `${id}.jpg`;

    const webSrc = path.join(ROOT, "public", src.web);
    const thumbSrc = path.join(ROOT, "public", src.thumb);
    const originalSrc = path.join(ROOT, "public", src.original);

    copyFile(webSrc, path.join(staging, "photos", webName));
    copyFile(thumbSrc, path.join(staging, "thumbs", thumbName));
    copyFile(originalSrc, path.join(staging, "originals", originalName));

    gallery.push({
      id,
      title: src.title,
      width: src.width,
      height: src.height,
      orientation: src.orientation,
      web: `photos/${webName}`,
      thumb: `thumbs/${thumbName}`,
      original: `originals/${originalName}`,
      aspectRatio: src.aspectRatio,
      ...(src.family?.length ? { family: src.family } : {}),
    });

    console.log(`  ${String(i + 1).padStart(2, "0")}. ${title}`);
  }

  for (const d of Object.values(dirs)) clearDir(d);
  for (const [kind, dir] of Object.entries(dirs)) {
    for (const f of fs.readdirSync(path.join(staging, kind))) {
      fs.copyFileSync(path.join(staging, kind, f), path.join(dir, f));
    }
  }

  fs.rmSync(staging, { recursive: true, force: true });

  fs.writeFileSync(
    GALLERY_PATH,
    JSON.stringify({ updated: new Date().toISOString(), photos: gallery }, null, 2)
  );

  console.log(`\nGallery aggiornata: ${gallery.length} foto in vetrina.`);
}

main();
