/**
 * Importa foto da cartella reflex, seleziona le migliori con filtro famiglia.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { getExportSettings, exportPhotoFiles } = require("./export-utils");
const { FamilyScoreCache } = require("./family-score-cache");
const {
  configureFamilyMatcher,
  loadFamilyReferences,
  scoreFamilyPhoto,
  getFamilyMatcher,
} = require("./family-matcher-loader");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);
const FAMILY = CONFIG.familyFilter || {};

const sourceArg = process.argv[2] || CONFIG.sourceFolder;
if (!sourceArg || !fs.existsSync(sourceArg)) {
  console.error("Specifica la cartella foto:");
  console.error('  npm run import -- "E:\\100_FUJI"');
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

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "?";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function scoreImage(filePath, familyEnabled, cache) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return null;
  }

  if (familyEnabled && cache) {
    const cached = cache.get(filePath, stat);
    if (cached) {
      if (cached.familyScore === 0) return null;
      return { filePath, meta: cached.meta, score: cached.score, size: stat.size, family: cached.family };
    }
  }

  let meta;
  try {
    meta = await sharp(filePath).metadata();
  } catch {
    return null;
  }
  const pixels = (meta.width || 0) * (meta.height || 0);
  if (pixels < 400_000) return null;

  let family = { familyScore: 0, members: [] };
  if (familyEnabled) {
    try {
      family = await scoreFamilyPhoto(filePath, { minMatches: FAMILY.minMatches ?? 1 });
    } catch {
      return null;
    }
    if (family.familyScore === 0) {
      cache?.set(filePath, stat, { familyScore: 0, family, meta: null, score: 0 });
      return null;
    }
  }

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
  const qualityScore = megapixels * 40 + sharpness * 0.15 + Math.log10(stat.size + 1) * 5;
  const score = qualityScore + (family.familyScore || 0);
  const result = { filePath, meta, score, size: stat.size, family };

  if (familyEnabled && cache) {
    cache.set(filePath, stat, { familyScore: family.familyScore, family, meta, score });
  }

  return result;
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
  const familyEnabled = FAMILY.enabled !== false;
  let familyActive = false;
  const concurrency = FAMILY.concurrency ?? Math.min(4, os.cpus().length || 2);
  const useCache = FAMILY.useCache !== false;
  const cache = new FamilyScoreCache(useCache && familyEnabled);

  if (familyEnabled && getFamilyMatcher()) {
    configureFamilyMatcher({
      quickDetectMaxSize: FAMILY.quickDetectMaxSize ?? 512,
      matchDetectMaxSize: FAMILY.matchDetectMaxSize ?? 1024,
      minConfidence: FAMILY.minConfidence ?? 0.45,
    });

    const refDir = path.resolve(ROOT, FAMILY.referenceDir || "config/family");
    console.log("Caricamento riferimenti famiglia da:", refDir);
    const matcher = await loadFamilyReferences(refDir, FAMILY.matchThreshold ?? 0.62);
    if (matcher) {
      familyActive = true;
      console.log("Filtro famiglia attivo (Marco, Laura, Luca, Giorgia).");
      console.log(`  Modalità veloce: pre-filtro volti + cache${useCache ? " attiva" : " disattiva"}`);
      console.log(`  Parallelismo: ${concurrency} foto alla volta`);
    } else {
      console.warn("ATTENZIONE: nessun riferimento in config/family/ — import senza filtro famiglia.");
    }
  }

  console.log("Scansione:", sourceArg);
  const all = walk(sourceArg);
  console.log(`Trovate ${all.length} immagini.`);

  const started = Date.now();
  let done = 0;
  let cacheHits = 0;

  const results = await mapPool(all, concurrency, async (filePath) => {
    if (familyActive && cache.enabled && cache.get(filePath)) cacheHits++;
    const result = await scoreImage(filePath, familyActive, cache);
    done++;
    if (done % 10 === 0 || done === all.length) {
      const elapsed = (Date.now() - started) / 1000;
      const rate = done / elapsed;
      const eta = formatEta((all.length - done) / rate);
      process.stdout.write(`  Analisi ${done}/${all.length} — ETA ${eta}    \r`);
    }
    if (done % 100 === 0) cache.save();
    return result;
  });

  cache.save();
  console.log("");

  const scored = results.filter(Boolean);
  const skipped = all.length - scored.length;
  if (familyActive && useCache && cacheHits > 0) {
    console.log(`Cache riutilizzata per ${cacheHits} foto già analizzate.`);
  }
  console.log(`Idonee: ${scored.length}, escluse: ${skipped}.`);

  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, CONFIG.maxGalleryPhotos);
  console.log(`Selezionate ${picked.length} migliori foto (max ${CONFIG.maxGalleryPhotos}).`);

  const gallery = [];
  for (let i = 0; i < picked.length; i++) {
    const { filePath, family } = picked[i];
    const id = slug(filePath, i + 1);
    const entry = await exportPhoto(filePath, id);
    if (family?.members?.length) entry.family = family.members;
    gallery.push(entry);
    process.stdout.write(`  Esportata ${i + 1}/${picked.length}: ${path.basename(filePath)}\n`);
  }

  fs.writeFileSync(
    OUT.data,
    JSON.stringify({ updated: new Date().toISOString(), photos: gallery }, null, 2)
  );

  const totalMin = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\nGallery pronta in public/ (${totalMin} min) — avvia con: npm run serve`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
