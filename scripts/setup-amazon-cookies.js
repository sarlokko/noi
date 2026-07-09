/**
 * Crea config/amazon-photos-cookies.json dal template, se non esiste già.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EXAMPLE = path.join(ROOT, "config", "amazon-photos-cookies.example.json");
const TARGET = path.join(ROOT, "config", "amazon-photos-cookies.json");

if (fs.existsSync(TARGET)) {
  console.log("Già presente:", TARGET);
  console.log("Apri il file e inserisci i cookie da amazon.it/photos");
  process.exit(0);
}

if (!fs.existsSync(EXAMPLE)) {
  console.error("Template mancante:", EXAMPLE);
  process.exit(1);
}

fs.copyFileSync(EXAMPLE, TARGET);
console.log("Creato:", TARGET);
console.log("");
console.log("Prossimi passi:");
console.log("1. Apri amazon.it/photos e accedi");
console.log("2. DevTools (F12) → Application → Cookies → amazon.it");
console.log("3. Copia ubid-acbit, at-acbit, session-id nel file sopra");
console.log("4. npm run amazon:verify");
