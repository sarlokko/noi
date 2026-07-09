/**
 * Test riconoscimento famiglia prima dell'import completo.
 *
 * Uso:
 *   npm run family:test
 *   npm run family:test -- --folder "E:\100_FUJI" --sample 80
 */

const fs = require("fs");
const path = require("path");
const {
  configureFamilyMatcher,
  loadFamilyReferences,
  scoreFamilyPhoto,
  scoreReferenceFile,
  getFamilyMatcher,
} = require("./family-matcher-loader");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const FAMILY = CONFIG.familyFilter || {};
const REPORT_DIR = path.join(ROOT, "reports");
const REPORT_PATH = path.join(REPORT_DIR, "family-test-report.txt");

const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    folder: CONFIG.sourceFolder || null,
    sample: 60,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--folder" && args[i + 1]) opts.folder = args[++i];
    else if (args[i] === "--sample" && args[i + 1]) opts.sample = Math.max(1, parseInt(args[++i], 10) || 60);
  }
  return opts;
}

function walk(dir, files = []) {
  if (!dir || !fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXT.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function pickSample(files, n) {
  if (files.length <= n) return files;
  const step = files.length / n;
  const picked = [];
  for (let i = 0; i < n; i++) picked.push(files[Math.floor(i * step)]);
  return picked;
}

function lines(...parts) {
  return parts.filter(Boolean).join("\n");
}

async function main() {
  const opts = parseArgs();
  const threshold = FAMILY.matchThreshold ?? 0.62;
  const report = [];
  let failed = false;

  const log = (msg) => {
    console.log(msg);
    report.push(msg);
  };

  log("=== Test riconoscimento famiglia ===");
  log(`Data: ${new Date().toLocaleString("it-IT")}`);
  log("");

  if (!getFamilyMatcher()) {
    log("❌ Filtro famiglia non disponibile. Esegui: npm install");
    failed = true;
    writeReport(report);
    process.exit(1);
  }

  configureFamilyMatcher({
    matchDetectMaxSize: FAMILY.matchDetectMaxSize ?? 640,
  });

  const refDir = path.resolve(ROOT, FAMILY.referenceDir || "config/family");
  log(`Riferimenti: ${refDir}`);

  if (!fs.existsSync(refDir)) {
    log("❌ Cartella config/family/ assente.");
    log("   Crea i riferimenti con:");
    log('   npm run family:setup -- --group "E:\\foto\\pisa.jpg" marco luca giorgia laura');
    failed = true;
    writeReport(report);
    process.exit(1);
  }

  const refFiles = fs
    .readdirSync(refDir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();

  if (!refFiles.length) {
    log("❌ Nessuna foto in config/family/ (servono marco.jpg, laura.jpg, luca.jpg, giorgia.jpg).");
    failed = true;
    writeReport(report);
    process.exit(1);
  }

  log(`Trovati ${refFiles.length} riferimenti: ${refFiles.join(", ")}`);
  log("");

  const matcher = await loadFamilyReferences(refDir, threshold);
  if (!matcher) {
    log("❌ Impossibile caricare i volti di riferimento (nessun volto rilevato?).");
    failed = true;
    writeReport(report);
    process.exit(1);
  }

  log("--- Test 1: auto-riconoscimento riferimenti ---");
  let selfOk = 0;
  for (const file of refFiles) {
    const name = path.basename(file, path.extname(file)).toLowerCase();
    const full = path.join(refDir, file);
    const result = await scoreReferenceFile(full, name, { minMatches: 1 });
    const ok = result.members.includes(name);
    const icon = ok ? "✅" : "❌";
    const detail = result.faceCount ? `volti: ${result.faceCount}` : "sidecar";
    log(`${icon} ${file} → riconosciuto come: ${result.members.join(", ") || "nessuno"} (${detail})`);
    if (ok) selfOk++;
    else failed = true;
  }
  log(`Auto-test: ${selfOk}/${refFiles.length} OK`);
  log("");

  if (opts.folder && fs.existsSync(opts.folder)) {
    log(`--- Test 2: campione da ${opts.folder} (${opts.sample} foto) ---`);
    const all = walk(opts.folder);
    const sample = pickSample(all, opts.sample);
    log(`Scansionate ${sample.length} foto su ${all.length} totali.`);

    let withFaces = 0;
    let familyHits = 0;
    const examples = [];

    for (let i = 0; i < sample.length; i++) {
      const filePath = sample[i];
      const result = await scoreFamilyPhoto(filePath, { minMatches: FAMILY.minMatches ?? 1 });
      if (result.faceCount === 0 && result.familyScore === 0) continue;
      if (result.faceCount > 0) withFaces++;
      if (result.familyScore > 0) {
        familyHits++;
        if (examples.length < 8) {
          examples.push(`${path.basename(filePath)} → ${result.members.join(", ")}`);
        }
      }
      if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${sample.length}\r`);
    }
    console.log("");

    const rate = sample.length ? ((familyHits / sample.length) * 100).toFixed(1) : "0";
    log(`Con volti: ${withFaces}, famiglia: ${familyHits} (${rate}% del campione)`);
    if (examples.length) {
      log("Esempi riconosciuti:");
      examples.forEach((e) => log(`  • ${e}`));
    }
    log("");

    if (familyHits === 0) {
      log("⚠️  Nessuna foto famiglia nel campione.");
      log("   Possibili cause: riferimenti sbagliati, soglia troppo alta, o campione sfortunato.");
      log("   Prova: npm run family:test -- --sample 150");
      failed = true;
    } else if (familyHits < Math.max(2, Math.floor(sample.length * 0.02))) {
      log("⚠️  Poche foto famiglia nel campione — verifica i riferimenti prima dell'import.");
    } else {
      log("✅ Campione OK: il filtro trova foto di famiglia.");
    }
  } else {
    log(`--- Test 2: saltato (cartella non trovata: ${opts.folder || "non configurata"}) ---`);
    log("   Imposta sourceFolder in config.json o usa --folder");
  }

  log("");
  if (failed) {
    log("❌ TEST NON SUPERATO — correggi config/family/ prima dell'import completo.");
    log("");
    log("Come sistemare:");
    log("  1. Foto frontali, ben illuminate, un volto per file");
    log('  2. npm run family:setup -- --group "E:\\foto\\gruppo.jpg" marco luca giorgia laura');
    log("  3. Rilancia: npm run family:test");
  } else {
    log("✅ TEST SUPERATO — puoi avviare l'import con import-auto.bat o npm run import");
  }

  writeReport(report);
  process.exit(failed ? 1 : 0);
}

function writeReport(lines) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join("\n") + "\n", "utf8");
  console.log(`\nReport salvato: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
