/**
 * Verifica che il filtro famiglia sia pronto.
 * Uso: npm run family:verify
 */

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
    const { loadFamilyReferences } = require("./family-matcher-loader");
    console.log("\n✅ Filtro famiglia pronto (TensorFlow CPU).\n");
  } catch (err) {
    console.error("\n❌ Errore caricamento:", err.message);
    process.exit(1);
  }
})();
