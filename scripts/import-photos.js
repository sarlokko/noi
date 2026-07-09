/**
 * Importa foto da cartella reflex.
 *
 * Modalità:
 *   npm run import -- "E:\100_FUJI"          import completo (usa indice)
 *   npm run import:scan -- "E:\100_FUJI"     solo indicizza (prima volta / overnight)
 *   npm run import:update                      solo foto nuove + aggiorna gallery
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { getExportSettings, exportPhotoFiles } = require("./export-utils");
const { PhotoIndex } = require("./photo-index");
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

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.includes("--scan") ? "scan" : args.includes("--update") ? "update" : "import";
  const folder = args.find((a) => !a.startsWith("--")) || CONFIG.sourceFolder;
  return { mode, folder };
}

const { mode, folder: sourceArg } = parseArgs();

if (!sourceArg || !fs.existsSync(sourceArg)) {
  console.error("Specifica la cartella foto:");
  console.error('  npm run import -- "E:\\100_FUJI"');
  console.error('  npm run import:scan -- "E:\\100_FUJI"');
  process.exit(1);
}

const OUT = {
  photos: path.join(ROOT, "public", "photos"),
  thumbs: path.join(ROOT, "public", "thumbs"),
  originals: path.join(ROOT, "public", "originals"),
  data: path.join(ROOT, "public", "data", "gallery.json"),
};

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

async function computeQuality(filePath, meta, stat) {
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

  const pixels = (meta.width || 0) * (meta.height || 0);
  const megapixels = pixels / 1_000_000;
  return megapixels * 40 + sharpness * 0.15 + Math.log10(stat.size + 1) * 5;
}

async function analyzeOne(filePath, familyActive, familyOpts) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return null;
  }

  let meta;
  try {
    meta = await sharp(filePath).metadata();
  } catch {
    return null;
  }

  const pixels = (meta.width || 0) * (meta.height || 0);
  if (pixels < 400_000) {
    return {
      filePath,
      stat,
      familyScore: 0,
      members: [],
      hasFaces: false,
      qualityScore: 0,
      totalScore: 0,
      width: meta.width,
      height: meta.height,
    };
  }

  let family;
  if (familyActive) {
    family = await scoreFamilyPhoto(filePath, familyOpts);
  } else {
    family = { familyScore: 1, members: [], hasFaces: true, faceCount: 0 };
  }

  const qualityScore =
    family.familyScore > 0 || !familyActive
      ? await computeQuality(filePath, meta, stat)
      : 0;

  return {
    filePath,
    stat,
    familyScore: family.familyScore || 0,
    members: family.members || [],
    hasFaces: family.hasFaces ?? family.faceCount > 0,
    faceCount: family.faceCount || 0,
    qualityScore,
    totalScore: qualityScore + (family.familyScore || 0),
    width: meta.width,
    height: meta.height,
  };
}

async function scanFiles(files, familyActive, index, familyOpts) {
  const toProcess = [];
  let skipped = 0;

  for (const filePath of files) {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (index.isCurrent(filePath, stat)) {
      skipped++;
      continue;
    }
    toProcess.push({ filePath, stat });
  }

  console.log(`Indice: ${skipped} già analizzate, ${toProcess.length} da processare.`);

  if (!toProcess.length) return { skipped, processed: 0 };

  const started = Date.now();

  for (let i = 0; i < toProcess.length; i++) {
    const { filePath, stat } = toProcess[i];
    const result = await analyzeOne(filePath, familyActive, familyOpts);
    if (result) {
      index.set(filePath, stat, {
        familyScore: result.familyScore,
        members: result.members,
        hasFaces: result.hasFaces,
        faceCount: result.faceCount,
        qualityScore: result.qualityScore,
        totalScore: result.totalScore,
        width: result.width,
        height: result.height,
      });
    }

    const done = i + 1;
    if (done % 5 === 0 || done === toProcess.length) {
      const elapsed = (Date.now() - started) / 1000;
      const rate = done / Math.max(elapsed, 0.1);
      const eta = formatEta((toProcess.length - done) / rate);
      process.stdout.write(`  Scansione ${done}/${toProcess.length} — ETA ${eta}    \r`);
    }
    if (done % 50 === 0) index.save();
  }

  index.save();
  console.log("");
  return { skipped, processed: toProcess.length };
}

function clearOutputDirs() {
  for (const d of Object.values(OUT)) {
    if (d.endsWith(".json")) {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      continue;
    }
    fs.mkdirSync(d, { recursive: true });
    fs.readdirSync(d).forEach((f) => fs.unlinkSync(path.join(d, f)));
  }
}

function slug(name, i) {
  const base = path.basename(name, path.extname(name))
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40) || `foto-${i}`;
  return `${String(i).padStart(2, "0")}-${base}`;
}

async function buildGallery(index, familyActive) {
  let candidates = index.familyCandidates();

  if (!familyActive) {
    candidates = Object.entries(index.data.files).map(([filePath, e]) => ({
      filePath,
      ...e,
    }));
  }

  for (const c of candidates) {
    if (!c.qualityScore && c.familyScore > 0) {
      let stat, meta;
      try {
        stat = fs.statSync(c.filePath);
        meta = await sharp(c.filePath).metadata();
        c.qualityScore = await computeQuality(c.filePath, meta, stat);
        c.totalScore = c.qualityScore + c.familyScore;
        index.set(c.filePath, stat, c);
      } catch {
        c.totalScore = c.familyScore;
      }
    }
  }

  candidates.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  return candidates.slice(0, CONFIG.maxGalleryPhotos);
}

async function main() {
  const familyEnabled = FAMILY.enabled !== false;
  let familyActive = false;
  const index = new PhotoIndex(sourceArg, FAMILY.useIndex !== false);
  const familyOpts = { minMatches: FAMILY.minMatches ?? 1 };

  if (familyEnabled && getFamilyMatcher()) {
    configureFamilyMatcher({
      matchDetectMaxSize: FAMILY.matchDetectMaxSize ?? 640,
      detectMaxSize: FAMILY.matchDetectMaxSize ?? 640,
      tinyInputSize: FAMILY.tinyInputSize ?? 416,
    });

    const refDir = path.resolve(ROOT, FAMILY.referenceDir || "config/family");
    console.log("Caricamento riferimenti famiglia da:", refDir);
    const matcher = await loadFamilyReferences(refDir, FAMILY.matchThreshold ?? 0.62);
    if (matcher) {
      familyActive = true;
      console.log("Filtro famiglia attivo — modalità single-pass (TinyFaceDetector).");
    } else {
      console.warn("ATTENZIONE: nessun riferimento — import senza filtro famiglia.");
    }
  }

  console.log("Cartella:", sourceArg);
  console.log("Modalità:", mode === "scan" ? "indicizzazione" : mode === "update" ? "aggiornamento incrementale" : "import completo");

  const all = walk(sourceArg);
  console.log(`Trovate ${all.length} immagini.`);

  index.pruneMissing(all);
  const started = Date.now();

  await scanFiles(all, familyActive, index, familyOpts);

  const istats = index.stats();
  console.log(`Indice: ${istats.total} foto, ${istats.family} famiglia, ${istats.noFace} senza volti.`);

  if (mode === "scan") {
    const totalMin = ((Date.now() - started) / 60000).toFixed(1);
    console.log(`\nIndicizzazione completata (${totalMin} min).`);
    console.log("Prossimo passo: npm run import:update");
    return;
  }

  const picked = await buildGallery(index, familyActive);
  console.log(`Selezionate ${picked.length} migliori foto (max ${CONFIG.maxGalleryPhotos}).`);

  if (!picked.length) {
    console.error("Nessuna foto idonea. Verifica config/family/ con npm run family:test");
    process.exit(1);
  }

  clearOutputDirs();
  const gallery = [];

  for (let i = 0; i < picked.length; i++) {
    const { filePath, members } = picked[i];
    const id = slug(filePath, i + 1);
    const entry = await exportPhotoFiles(filePath, OUT, id, getExportSettings(CONFIG));
    entry.sourcePath = filePath;
    if (members?.length) entry.family = members;
    gallery.push(entry);
    process.stdout.write(`  Esportata ${i + 1}/${picked.length}: ${path.basename(filePath)}\n`);
  }

  fs.writeFileSync(
    OUT.data,
    JSON.stringify({ updated: new Date().toISOString(), photos: gallery }, null, 2)
  );

  index.save();
  const totalMin = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\nGallery pronta in public/ (${totalMin} min) — avvia con: npm run serve`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
