/**
 * Rimuove le foto in config.excludePhotos e le sostituisce con altre
 * disponibili nel pool di export (public/ + ref git opzionale).
 *
 *   npm run gallery:rebuild
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const GALLERY_PATH = path.join(ROOT, "public", "data", "gallery.json");
const POOL_REF = CONFIG.replacementPoolRef || "origin/cursor/family-gallery-50-8786";

function slug(name, i) {
  const base = name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").slice(0, 40) || `foto-${i}`;
  return `${String(i).padStart(2, "0")}-${base}`;
}

function normalizeTitle(name) {
  return path.basename(name, path.extname(name)).toUpperCase();
}

function gitShowJson(ref, filePath) {
  const raw = execSync(`git show ${ref}:${filePath}`, { cwd: ROOT, encoding: "utf8" });
  return JSON.parse(raw);
}

function gitShowFile(ref, filePath) {
  return execSync(`git show ${ref}:${filePath}`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
}

function readAsset(relativePath, sourceGallery, sourceRef) {
  const local = path.join(ROOT, "public", relativePath);
  if (fs.existsSync(local)) return fs.readFileSync(local);
  if (sourceRef) return gitShowFile(sourceRef, path.posix.join("public", relativePath));
  throw new Error(`Asset mancante: ${relativePath}`);
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function clearDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
}

function loadPoolGallery() {
  const pools = [{ gallery: JSON.parse(fs.readFileSync(GALLERY_PATH, "utf8")), ref: null }];

  try {
    pools.push({ gallery: gitShowJson(POOL_REF, "public/data/gallery.json"), ref: POOL_REF });
  } catch (e) {
    console.warn(`Pool aggiuntivo non disponibile (${POOL_REF}): ${e.message}`);
  }

  return pools;
}

function findInPools(title, pools) {
  const key = normalizeTitle(title);
  for (const pool of pools) {
    const match = pool.gallery.photos.find((p) => normalizeTitle(p.title) === key);
    if (match) return { entry: match, ref: pool.ref };
  }
  return null;
}

function main() {
  const excluded = new Set((CONFIG.excludePhotos || []).map(normalizeTitle));
  if (!excluded.size) {
    console.error("Aggiungi excludePhotos in config.json");
    process.exit(1);
  }

  const current = JSON.parse(fs.readFileSync(GALLERY_PATH, "utf8"));
  const pools = loadPoolGallery();
  const maxPhotos = CONFIG.maxGalleryPhotos || current.photos.length;

  const kept = current.photos.filter((p) => !excluded.has(normalizeTitle(p.title)));
  const removed = current.photos.filter((p) => excluded.has(normalizeTitle(p.title)));
  const used = new Set(kept.map((p) => normalizeTitle(p.title)));
  const replacements = [];

  for (const pool of pools) {
    for (const photo of pool.gallery.photos) {
      const key = normalizeTitle(photo.title);
      if (excluded.has(key) || used.has(key)) continue;
      replacements.push({ entry: photo, ref: pool.ref });
      used.add(key);
      if (replacements.length >= removed.length) break;
    }
    if (replacements.length >= removed.length) break;
  }

  if (replacements.length < removed.length) {
    console.error(
      `Trovate solo ${replacements.length} sostitutive su ${removed.length} richieste.`,
      "Esegui npm run import:update sul PC con la cartella foto per completare."
    );
    process.exit(1);
  }

  console.log(`Rimosse ${removed.length} foto:`);
  removed.forEach((p) => console.log(`  - ${p.title}`));
  console.log(`\nAggiunte ${replacements.length} sostitutive:`);
  replacements.forEach(({ entry }) => console.log(`  + ${entry.title}`));

  const finalPhotos = [...kept, ...replacements.map((r) => r.entry)].slice(0, maxPhotos);
  const staging = path.join(ROOT, "public", ".gallery-staging");
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.join(staging, "photos"), { recursive: true });
  fs.mkdirSync(path.join(staging, "thumbs"), { recursive: true });
  fs.mkdirSync(path.join(staging, "originals"), { recursive: true });

  const gallery = [];

  for (let i = 0; i < finalPhotos.length; i++) {
    const src = finalPhotos[i];
    const source = findInPools(src.title, pools);
    const id = slug(src.title, i + 1);
    const webName = `${id}.webp`;
    const thumbName = `${id}-thumb.webp`;
    const originalName = `${id}.jpg`;

    const webBuf = readAsset(src.web, source?.gallery, source?.ref);
    const thumbBuf = readAsset(src.thumb, source?.gallery, source?.ref);
    const originalBuf = readAsset(src.original, source?.gallery, source?.ref);

    fs.writeFileSync(path.join(staging, "photos", webName), webBuf);
    fs.writeFileSync(path.join(staging, "thumbs", thumbName), thumbBuf);
    fs.writeFileSync(path.join(staging, "originals", originalName), originalBuf);

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
  }

  const dirs = {
    photos: path.join(ROOT, "public", "photos"),
    thumbs: path.join(ROOT, "public", "thumbs"),
    originals: path.join(ROOT, "public", "originals"),
  };

  for (const d of Object.values(dirs)) clearDir(d);
  for (const [kind, dir] of Object.entries(dirs)) {
    for (const f of fs.readdirSync(path.join(staging, kind))) {
      copyFile(path.join(staging, kind, f), path.join(dir, f));
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
