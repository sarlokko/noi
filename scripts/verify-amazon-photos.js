/**
 * Verifica connessione Amazon Photos e mostra statistiche storage.
 */

const path = require("path");
const { AmazonPhotosClient, loadCookies } = require("./amazon-photos-client");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(require("fs").readFileSync(path.join(ROOT, "config.json"), "utf8"));
const AP = CONFIG.amazonPhotos || {};
const COOKIES_FILE = path.resolve(ROOT, AP.cookiesFile || "config/amazon-photos-cookies.json");

async function main() {
  const cookies = loadCookies(COOKIES_FILE);
  const client = new AmazonPhotosClient(cookies, { tld: AP.tld });

  console.log("Verifica connessione Amazon Photos...");
  const root = await client.getRoot();
  console.log(`✅ Connesso (account: ${root.ownerId?.slice(0, 8)}…)`);

  const usage = await client.getUsage();
  for (const [type, stats] of Object.entries(usage)) {
    if (!stats?.total) continue;
    const gb = (stats.total.bytes / 1e9).toFixed(2);
    console.log(`  ${type}: ${stats.total.count} file, ${gb} GB`);
  }
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
