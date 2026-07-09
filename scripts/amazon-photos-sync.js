/**
 * Scarica foto da Amazon Photos in .cache/amazon-photos/ (sync incrementale).
 */

const fs = require("fs");
const path = require("path");
const { AmazonPhotosClient, loadCookies, mapPool } = require("./amazon-photos-client");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const AP = CONFIG.amazonPhotos || {};

const CACHE_DIR = path.resolve(ROOT, AP.cacheDir || ".cache/amazon-photos");
const MANIFEST_PATH = path.resolve(ROOT, AP.manifestPath || ".cache/amazon-photos-manifest.json");
const COOKIES_FILE = path.resolve(ROOT, AP.cookiesFile || "config/amazon-photos-cookies.json");
const FILTERS = AP.filters || "type:(PHOTOS)";
const CONCURRENCY = AP.downloadConcurrency || 4;

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { version: 1, lastSync: null, nodes: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return { version: 1, lastSync: null, nodes: {} };
  }
}

function saveManifest(manifest) {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  manifest.lastSync = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function nodeModified(node) {
  return node.modifiedDate || node.createdDate || "";
}

function needsDownload(node, manifestEntry) {
  if (!manifestEntry) return true;
  if (!fs.existsSync(manifestEntry.localPath)) return true;
  return nodeModified(node) !== manifestEntry.modifiedDate;
}

async function syncAmazonPhotos(options = {}) {
  const cookies = loadCookies(COOKIES_FILE);
  const client = new AmazonPhotosClient(cookies, { tld: AP.tld });
  const manifest = loadManifest();
  const maxPhotos = options.maxPhotos ?? AP.maxPhotos ?? Infinity;

  console.log("Connessione Amazon Photos...");
  const usage = await client.getUsage();
  const photoStats = usage.PHOTOS || usage.photos;
  if (photoStats?.total?.count) {
    console.log(`Library: ~${photoStats.total.count} foto su Amazon Photos`);
  }

  console.log(`Ricerca foto (filtro: ${FILTERS})...`);
  const nodes = await client.searchAll(FILTERS, maxPhotos);
  console.log(`Trovate ${nodes.length} foto su Amazon.`);

  const toDownload = [];
  const remoteIds = new Set();

  for (const node of nodes) {
    remoteIds.add(node.id);
    const entry = manifest.nodes[node.id];
    if (needsDownload(node, entry)) {
      toDownload.push(node);
    }
  }

  const stale = Object.keys(manifest.nodes).filter((id) => !remoteIds.has(id));
  for (const id of stale) {
    const entry = manifest.nodes[id];
    if (entry?.localPath && fs.existsSync(entry.localPath)) {
      fs.unlinkSync(entry.localPath);
    }
    delete manifest.nodes[id];
  }

  console.log(
    `Sync: ${nodes.length - toDownload.length} già in cache, ${toDownload.length} da scaricare` +
      (stale.length ? `, ${stale.length} rimosse` : "")
  );

  if (toDownload.length) {
    let done = 0;
    await mapPool(toDownload, CONCURRENCY, async (node) => {
      const result = await client.downloadNode(node.id, CACHE_DIR);
      manifest.nodes[node.id] = {
        localPath: result.localPath,
        name: node.name || result.fileName,
        modifiedDate: nodeModified(node),
        size: result.size,
        amazonId: node.id,
      };
      done++;
      process.stdout.write(`  Scaricate ${done}/${toDownload.length}\r`);
    });
    console.log("");
  }

  saveManifest(manifest);

  const files = Object.values(manifest.nodes)
    .map((e) => e.localPath)
    .filter((p) => fs.existsSync(p));

  return { cacheDir: CACHE_DIR, files, manifest };
}

async function main() {
  const { files } = await syncAmazonPhotos();
  console.log(`\nSync completato: ${files.length} foto in ${CACHE_DIR}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

module.exports = { syncAmazonPhotos, CACHE_DIR, MANIFEST_PATH };
