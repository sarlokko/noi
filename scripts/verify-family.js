/**
 * Verifica che il filtro famiglia sia pronto.
 * Uso: npm run family:verify
 */

const nodeMajor = parseInt(process.version.slice(1).split(".")[0], 10);

console.log("Node.js:", process.version);

if (nodeMajor > 22) {
  console.error("\n❌ Node", nodeMajor, "non supportato per il filtro volti.");
  console.error("   Installa Node 22 LTS e riapri il terminale.");
  console.error("   Verifica con: node -v  →  deve essere v22.x.x\n");
  process.exit(1);
}

const required = ["@tensorflow/tfjs-node", "@vladmandic/face-api", "canvas"];
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
  console.error("   Esegui:\n");
  console.error("     rmdir /s /q node_modules");
  console.error("     npm install");
  console.error("     npm install @tensorflow/tfjs-node@4.22.0 @vladmandic/face-api@1.7.15 canvas@3.2.3\n");
  process.exit(1);
}

try {
  require("@tensorflow/tfjs-node");
  const { loadFamilyReferences } = require("./family-matcher-loader");
  console.log("\n✅ Filtro famiglia pronto.\n");
} catch (err) {
  console.error("\n❌ Errore caricamento:", err.message);
  process.exit(1);
}
