/**
 * Crea foto di riferimento per Marco, Laura, Luca, Giorgia.
 *
 * Uso singolo volto da foto esistente:
 *   node scripts/setup-family-refs.js marco "public/originals/20-DSCF1017.jpg"
 *
 * Uso foto di gruppo (volti ordinati da sinistra a destra):
 *   node scripts/setup-family-refs.js --group "C:\foto\pisa.jpg" marco luca giorgia laura
 */

const fs = require("fs");
const path = require("path");
const { detectFaces, extractReferenceFace, loadModels, saveSidecar } = require("./family-matcher");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "config", "family");

async function saveFaceByIndex(groupPath, names) {
  await loadModels();
  const faces = await detectFaces(groupPath);
  if (faces.length < names.length) {
    throw new Error(`Trovati ${faces.length} volti, ne servono ${names.length}`);
  }
  const sorted = [...faces].sort((a, b) => a.detection.box.x - b.detection.box.x);
  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 0; i < names.length; i++) {
    const name = names[i].toLowerCase();
    const box = sorted[i].detection.box;
    const img = await require("canvas").loadImage(groupPath);
    const pad = Math.round(Math.max(box.width, box.height) * 0.35);
    const x = Math.max(0, Math.floor(box.x - pad));
    const y = Math.max(0, Math.floor(box.y - pad));
    const w = Math.min(img.width - x, Math.ceil(box.width + pad * 2));
    const h = Math.min(img.height - y, Math.ceil(box.height + pad * 2));
    const c = require("canvas").createCanvas(w, h);
    c.getContext("2d").drawImage(img, x, y, w, h, 0, 0, w, h);
    const out = path.join(OUT, `${name}.jpg`);
    fs.writeFileSync(out, c.toBuffer("image/jpeg", { quality: 0.92 }));
    saveSidecar(out, name, sorted[i].descriptor);
    console.log(`Salvato: ${out}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(`Uso:
  npm run family:setup -- marco "percorso/foto.jpg"
  npm run family:setup -- --group "percorso/gruppo.jpg" marco luca giorgia laura`);
    process.exit(1);
  }

  if (args[0] === "--group") {
    const groupPath = args[1];
    const names = args.slice(2);
    if (!groupPath || names.length < 2) {
      console.error("Specifica foto di gruppo e nomi (ordine sinistra → destra).");
      process.exit(1);
    }
    if (!fs.existsSync(groupPath)) {
      console.error("File non trovato:", groupPath);
      process.exit(1);
    }
    console.log("Estrazione volti da:", groupPath);
    await saveFaceByIndex(groupPath, names);
    console.log("Riferimenti pronti in config/family/");
    return;
  }

  const name = args[0].toLowerCase();
  const src = args[1];
  if (!src || !fs.existsSync(src)) {
    console.error("Specifica un'immagine sorgente valida.");
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${name}.jpg`);
  await extractReferenceFace(src, out);
  console.log("Salvato:", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
