/**
 * Client non ufficiale per Amazon Photos (API reverse-engineered).
 * Richiede cookie di sessione da config/amazon-photos-cookies.json.
 */

const fs = require("fs");
const path = require("path");

const MAX_LIMIT = 200;
const EU_TLDS = new Set([
  "at", "be", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr", "de", "gr", "hu",
  "ie", "it", "lv", "lt", "lu", "mt", "nl", "pl", "pt", "ro", "sk", "si", "es", "se", "uk",
]);
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Safari/605.1.15",
];

function determineTld(cookies) {
  for (const key of Object.keys(cookies)) {
    if (key.endsWith("_main")) return "com";
    if (key.startsWith("at-acb")) return key.slice("at-acb".length);
  }
  return "com";
}

function loadCookies(cookiesFile) {
  if (!fs.existsSync(cookiesFile)) {
    throw new Error(
      `Cookie Amazon Photos non trovati: ${cookiesFile}\n` +
        "Copia config/amazon-photos-cookies.example.json e inserisci i cookie da amazon.it/photos"
    );
  }
  const cookies = JSON.parse(fs.readFileSync(cookiesFile, "utf8"));
  const required = ["session-id"];
  const hasAuth = Object.keys(cookies).some((k) => k.startsWith("at-acb") || k === "at_main");
  const hasUbid = Object.keys(cookies).some((k) => k.startsWith("ubid-acb") || k === "ubid_main");
  if (!hasAuth || !hasUbid) {
    throw new Error(
      "Cookie incompleti. Servono session-id, at-acbit (o at_main) e ubid-acbit (o ubid_main)."
    );
  }
  for (const key of required) {
    if (!cookies[key]) throw new Error(`Cookie mancante: ${key}`);
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class AmazonPhotosClient {
  constructor(cookies, options = {}) {
    this.cookies = cookies;
    this.tld = options.tld || determineTld(cookies);
    this.driveUrl = `https://www.amazon.${this.tld}/drive/v1`;
    this.cdproxyUrl = EU_TLDS.has(this.tld)
      ? "https://content-eu.drive.amazonaws.com/cdproxy/nodes"
      : "https://content-na.drive.amazonaws.com/cdproxy/nodes";
    this.sessionId = cookies["session-id"];
    this.userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    this.baseParams = {
      asset: "ALL",
      tempLink: "false",
      resourceVersion: "V2",
      ContentType: "JSON",
    };
    this.root = null;
  }

  headers() {
    return {
      "user-agent": this.userAgent,
      "x-amzn-sessionid": this.sessionId,
      cookie: cookieHeader(this.cookies),
    };
  }

  buildUrl(endpoint, params = {}) {
    const url = new URL(`${this.driveUrl}${endpoint}`);
    for (const [k, v] of Object.entries({ ...this.baseParams, ...params })) {
      url.searchParams.set(k, String(v));
    }
    return url;
  }

  async request(url, options = {}, retries = 5) {
    for (let i = 0; i <= retries; i++) {
      const res = await fetch(url, {
        ...options,
        headers: { ...this.headers(), ...options.headers },
      });

      if (res.status === 401) {
        throw new Error(
          "Cookie Amazon Photos scaduti. Accedi a amazon.it/photos e aggiorna config/amazon-photos-cookies.json"
        );
      }

      if (res.ok) return res;

      if (i === retries) {
        const body = await res.text().catch(() => "");
        throw new Error(`Amazon Photos API ${res.status}: ${body.slice(0, 200)}`);
      }

      await sleep(Math.min(Math.random() * 2 ** i * 1000, 20000));
    }
  }

  async getRoot() {
    if (this.root) return this.root;
    const url = this.buildUrl("/nodes", { filters: "isRoot:true" });
    const res = await this.request(url);
    const data = await res.json();
    this.root = data.data?.[0];
    if (!this.root) throw new Error("Impossibile ottenere root node Amazon Photos");
    return this.root;
  }

  async searchPage(filters, offset = 0, limit = MAX_LIMIT) {
    const url = this.buildUrl("/search", {
      limit,
      offset,
      filters,
      lowResThumbnail: "true",
      searchContext: "customer",
      sort: "['createdDate DESC']",
    });
    const res = await this.request(url);
    return res.json();
  }

  async searchAll(filters = "type:(PHOTOS)", maxPhotos = Infinity) {
    const initial = await this.searchPage(filters, 0, MAX_LIMIT);
    const total = Math.min(initial.count || 0, maxPhotos);
    const results = [...(initial.data || [])];

    for (let offset = MAX_LIMIT; offset < total; offset += MAX_LIMIT) {
      const page = await this.searchPage(filters, offset, MAX_LIMIT);
      results.push(...(page.data || []));
      if (!page.data?.length) break;
    }

    return results.slice(0, maxPhotos);
  }

  async getUsage() {
    const url = this.buildUrl("/account/usage");
    const res = await this.request(url);
    return res.json();
  }

  parseFilename(contentDisposition) {
    if (!contentDisposition) return null;
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    return match ? match[1].trim() : null;
  }

  async downloadNode(nodeId, outDir) {
    await fs.promises.mkdir(outDir, { recursive: true });
    const root = await this.getRoot();
    const url = this.buildUrl(`/nodes/${nodeId}/contentRedirection`, {
      querySuffix: "?download=true",
      ownerId: root.ownerId,
    });

    const res = await this.request(url);
    const fname =
      this.parseFilename(res.headers.get("content-disposition")) || `${nodeId}.jpg`;
    const safeName = fname.replace(/[<>:"/\\|?*]/g, "_");
    const localPath = path.join(outDir, `${nodeId}_${safeName}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.promises.writeFile(localPath, buffer);

    return {
      localPath,
      fileName: safeName,
      size: buffer.length,
    };
  }
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

module.exports = {
  AmazonPhotosClient,
  loadCookies,
  determineTld,
  mapPool,
  MAX_LIMIT,
};
