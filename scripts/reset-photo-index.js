/**
 * Resetta l'indice foto dopo aver aggiornato i riferimenti famiglia.
 * Le foto verranno rianalizzate al prossimo import:scan.
 */

const fs = require("fs");
const path = require("path");

const INDEX = path.join(__dirname, "..", ".cache", "photo-index.json");

if (fs.existsSync(INDEX)) {
  fs.unlinkSync(INDEX);
  console.log("Indice rimosso:", INDEX);
  console.log("Al prossimo import verranno rianalizzate tutte le foto con i nuovi riferimenti.");
} else {
  console.log("Nessun indice da rimuovere.");
}
