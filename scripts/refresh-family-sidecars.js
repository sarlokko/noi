/**
 * Rigenera i file .json (descrittori) per riferimenti esistenti in config/family/.
 * Utile se marco/laura falliscono l'auto-test senza sidecar.
 */

const fs = require("fs");
const path = require("path");
const { loadFamilyReferences } = require("./family-matcher-loader");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const refDir = path.resolve(ROOT, CONFIG.familyFilter?.referenceDir || "config/family");

async function main() {
  console.log("Rigenerazione sidecar in:", refDir);
  const matcher = await loadFamilyReferences(refDir, CONFIG.familyFilter?.matchThreshold ?? 0.62);
  if (!matcher) {
    console.error("Nessun riferimento caricato. Rigenera le foto con npm run family:setup");
    process.exit(1);
  }
  console.log("\nFatto. Esegui: npm run family:test");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
