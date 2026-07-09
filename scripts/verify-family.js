/**
 * Verifica che il filtro famiglia sia pronto.
 * Uso: npm run family:verify
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const FAMILY = CONFIG.familyFilter || {};

const required = [
  "@tensorflow/tfjs",
  "@tensorflow/tfjs-backend-cpu",
  "@vladmandic/face-api",
  "canvas",
];

console.log("Node.js:", process.version);

const missing = required.filter((pkg) => {
  try {
    require.resolve(pkg);
    return false;
  } catch {
    return true;
  }
});

if (missing.length) {
  console.error("\n❌ Pacchetti mancanti:", missing.join(", "));
  console.error("   Esegui: npm install\n");
  process.exit(1);
}

(async () => {
  try {
    require("./tfjs-cpu-shim");
    require("@vladmandic/face-api");
    const { loadFamilyReferences, getFamilyMatcher } = require("./family-matcher-loader");

    if (!getFamilyMatcher()) {
      console.error("\n❌ Modulo riconoscimento non caricato.\n");
      process.exit(1);
    }

    console.log("\n✅ Filtro famiglia pronto (TensorFlow CPU).");

    const refDir = path.resolve(ROOT, FAMILY.referenceDir || "config/family");
    if (!fs.existsSync(refDir)) {
      console.warn("\n⚠️  config/family/ non trovata — import senza filtro volti.");
      console.warn('   Crea riferimenti: npm run family:setup -- --group "percorso\\foto.jpg" marco luca giorgia laura\n');
      return;
    }

    const refs = fs.readdirSync(refDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (!refs.length) {
      console.warn("\n⚠️  Nessun riferimento in config/family/.\n");
      return;
    }

    console.log(`\nRiferimenti trovati (${refs.length}):`);
    const matcher = await loadFamilyReferences(refDir, FAMILY.matchThreshold ?? 0.62);
    if (matcher) {
      console.log("\n✅ Riferimenti caricati. Esegui npm run family:test prima dell'import.\n");
    } else {
      console.error("\n❌ Riferimenti presenti ma nessun volto rilevato — rigenera config/family/.\n");
      process.exit(1);
    }
  } catch (err) {
    console.error("\n❌ Errore caricamento:", err.message);
    process.exit(1);
  }
})();
