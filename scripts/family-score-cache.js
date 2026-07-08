const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "..", ".cache", "family-scores.json");

class FamilyScoreCache {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.data = {};
    this.dirty = false;
    if (enabled && fs.existsSync(CACHE_PATH)) {
      try {
        this.data = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
      } catch {
        this.data = {};
      }
    }
  }

  key(filePath, stat) {
    const s = stat || fs.statSync(filePath);
    return `${filePath}|${s.mtimeMs}|${s.size}`;
  }

  get(filePath, stat) {
    if (!this.enabled) return null;
    const hit = this.data[this.key(filePath, stat)];
    return hit ?? null;
  }

  set(filePath, stat, value) {
    if (!this.enabled) return;
    this.data[this.key(filePath, stat)] = value;
    this.dirty = true;
  }

  save() {
    if (!this.enabled || !this.dirty) return;
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(this.data));
    this.dirty = false;
  }
}

module.exports = { FamilyScoreCache, CACHE_PATH };
