/** Carica il filtro famiglia solo se le dipendenze opzionali sono installate. */

let cached = null;

function getFamilyMatcher() {
  if (cached === false) return null;
  if (cached) return cached;
  try {
    cached = require("./family-matcher");
    return cached;
  } catch (err) {
    console.warn("Filtro famiglia non disponibile:", err.message);
    console.warn("  L'import userà solo qualità/nitidezza (50 foto migliori).");
    console.warn("  Per il filtro volti: npm install && npm run family:verify");
    cached = false;
    return null;
  }
}

function configureFamilyMatcher(options) {
  const mod = getFamilyMatcher();
  if (mod) mod.configureFamilyMatcher(options);
}

async function loadFamilyReferences(refDir, threshold) {
  const mod = getFamilyMatcher();
  if (!mod) return null;
  return mod.loadFamilyReferences(refDir, threshold);
}

async function scoreFamilyPhoto(filePath, options) {
  const mod = getFamilyMatcher();
  if (!mod) return { familyScore: 0, members: [], faceCount: 0 };
  return mod.scoreFamilyPhoto(filePath, options);
}

async function scoreFamilyCanvas(imgCanvas, options) {
  const mod = getFamilyMatcher();
  if (!mod) return { familyScore: 0, members: [], faceCount: 0 };
  return mod.scoreFamilyCanvas(imgCanvas, options);
}

async function loadImageCanvas(filePath, maxSize) {
  const mod = getFamilyMatcher();
  if (!mod) return null;
  return mod.loadImageCanvas(filePath, maxSize);
}

async function scoreReferenceFile(imagePath, expectedName, options) {
  const mod = getFamilyMatcher();
  if (!mod) return { familyScore: 0, members: [], faceCount: 0 };
  return mod.scoreReferenceFile(imagePath, expectedName, options);
}

module.exports = {
  configureFamilyMatcher,
  loadFamilyReferences,
  scoreFamilyPhoto,
  scoreReferenceFile,
  scoreFamilyCanvas,
  loadImageCanvas,
  getFamilyMatcher,
};
