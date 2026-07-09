const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(__dirname, "..", ".cache", "photo-index.json");

class PhotoIndex {
  constructor(sourceFolder, enabled = true) {
    this.enabled = enabled;
    this.sourceFolder = sourceFolder;
    this.dirty = false;
    this.data = {
      version: 2,
      sourceFolder,
      lastScan: null,
      files: {},
    };

    if (!enabled || !fs.existsSync(INDEX_PATH)) return;

    try {
      const loaded = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
      if (loaded.sourceFolder === sourceFolder) this.data = loaded;
    } catch {
      this.data.files = {};
    }
  }

  isCurrent(filePath, stat) {
    if (!this.enabled) return false;
    const entry = this.data.files[filePath];
    if (!entry) return false;
    const s = stat || fs.statSync(filePath);
    return entry.mtimeMs === s.mtimeMs && entry.size === s.size;
  }

  get(filePath) {
    return this.data.files[filePath] ?? null;
  }

  set(filePath, stat, entry) {
    if (!this.enabled) return;
    this.data.files[filePath] = {
      ...entry,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      scannedAt: new Date().toISOString(),
    };
    this.dirty = true;
  }

  familyCandidates() {
    return Object.entries(this.data.files)
      .filter(([, e]) => e.familyScore > 0)
      .map(([filePath, e]) => ({ filePath, ...e }));
  }

  pruneMissing(existingPaths) {
    if (!this.enabled) return 0;
    const keep = new Set(existingPaths);
    let removed = 0;
    for (const filePath of Object.keys(this.data.files)) {
      if (!keep.has(filePath)) {
        delete this.data.files[filePath];
        removed++;
        this.dirty = true;
      }
    }
    return removed;
  }

  stats() {
    const files = Object.values(this.data.files);
    return {
      total: files.length,
      family: files.filter((e) => e.familyScore > 0).length,
      noFace: files.filter((e) => e.hasFaces === false).length,
    };
  }

  save() {
    if (!this.enabled || !this.dirty) return;
    this.data.lastScan = new Date().toISOString();
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify(this.data));
    this.dirty = false;
  }
}

module.exports = { PhotoIndex, INDEX_PATH };
