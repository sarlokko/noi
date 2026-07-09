/**
 * Riconoscimento volti famiglia (Marco, Laura, Luca, Giorgia).
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { ensureBackend } = require("./tfjs-cpu-shim");
const faceapi = require("@vladmandic/face-api");
const canvas = require("canvas");

faceapi.env.monkeyPatch({ Canvas: canvas.Canvas, Image: canvas.Image });

const ROOT = path.join(__dirname, "..");
const MODEL_PATH = path.join(ROOT, "node_modules/@vladmandic/face-api/model");

const SETTINGS = {
  quickDetectMaxSize: 512,
  matchDetectMaxSize: 1024,
  minConfidence: 0.45,
};

let modelsLoaded = false;
let matcher = null;

function configureFamilyMatcher(options = {}) {
  Object.assign(SETTINGS, options);
}

async function loadModels() {
  if (modelsLoaded) return;
  await ensureBackend();
  await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
  modelsLoaded = true;
}

async function loadImageCanvas(source, maxSize) {
  if (source instanceof canvas.Canvas) return source;

  let buffer;
  if (typeof source === "string") {
    buffer = await sharp(source)
      .rotate()
      .resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } else {
    buffer = source;
  }

  const img = await canvas.loadImage(buffer);
  const c = canvas.createCanvas(img.width, img.height);
  c.getContext("2d").drawImage(img, 0, 0);
  return c;
}

async function quickHasFaces(filePath) {
  try {
    const img = await loadImageCanvas(filePath, SETTINGS.quickDetectMaxSize);
    const faces = await faceapi.detectAllFaces(
      img,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })
    );
    return faces.length > 0;
  } catch {
    return false;
  }
}

async function detectFacesFull(source) {
  try {
    const img = await loadImageCanvas(source, SETTINGS.matchDetectMaxSize);
    return await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
  } catch {
    return [];
  }
}

async function loadFamilyReferences(refDir, threshold = 0.55) {
  await loadModels();
  if (!fs.existsSync(refDir)) return null;

  const files = fs
    .readdirSync(refDir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();

  if (!files.length) return null;

  const labeled = [];
  for (const file of files) {
    const name = path.basename(file, path.extname(file)).toLowerCase();
    const full = path.join(refDir, file);
    const faces = await detectFacesFull(full);
    if (!faces.length) {
      console.warn(`  Nessun volto in riferimento: ${file}`);
      continue;
    }
    const best = faces.reduce((a, b) => (a.detection.score > b.detection.score ? a : b));
    labeled.push(new faceapi.LabeledFaceDescriptors(name, [best.descriptor]));
    console.log(`  Riferimento: ${name} (${file})`);
  }

  if (!labeled.length) return null;
  matcher = new faceapi.FaceMatcher(labeled, threshold);
  return matcher;
}

async function scoreFamilyPhoto(filePath, options = {}) {
  const { minMatches = 1, skipQuick = false } = options;
  if (!matcher) return { familyScore: 0, matches: [], faceCount: 0, skippedQuick: false };

  try {
    if (!skipQuick && !(await quickHasFaces(filePath))) {
      return { familyScore: 0, matches: [], faceCount: 0, skippedQuick: true };
    }

    const faces = await detectFacesFull(filePath);
    if (!faces.length) return { familyScore: 0, matches: [], faceCount: 0, skippedQuick: false };

    const minConfidence = options.minConfidence ?? SETTINGS.minConfidence;
    const matches = [];
    const matchedMembers = new Set();

    for (const face of faces) {
      if (face.detection.score < minConfidence) continue;
      const best = matcher.findBestMatch(face.descriptor);
      if (best.label === "unknown") continue;
      matches.push({ member: best.label, distance: best.distance, score: face.detection.score });
      matchedMembers.add(best.label);
    }

    const familyScore =
      matchedMembers.size >= minMatches ? matchedMembers.size * 100 + matches.length * 10 : 0;
    return {
      familyScore,
      matches,
      faceCount: faces.length,
      members: [...matchedMembers],
      skippedQuick: false,
    };
  } catch {
    return { familyScore: 0, matches: [], faceCount: 0, skippedQuick: false };
  }
}

async function extractReferenceFace(sourcePath, outPath) {
  await loadModels();
  const faces = await detectFacesFull(sourcePath);
  if (!faces.length) throw new Error(`Nessun volto in ${sourcePath}`);
  const best = faces.reduce((a, b) => (a.detection.score > b.detection.score ? a : b));
  const box = best.detection.box;
  const img = await loadImageCanvas(sourcePath, SETTINGS.matchDetectMaxSize);
  const pad = Math.round(Math.max(box.width, box.height) * 0.3);
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  const w = Math.min(img.width - x, Math.ceil(box.width + pad * 2));
  const h = Math.min(img.height - y, Math.ceil(box.height + pad * 2));
  const c = canvas.createCanvas(w, h);
  c.getContext("2d").drawImage(img, x, y, w, h, 0, 0, w, h);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, c.toBuffer("image/jpeg", { quality: 0.92 }));
}

module.exports = {
  configureFamilyMatcher,
  loadFamilyReferences,
  scoreFamilyPhoto,
  extractReferenceFace,
  loadModels,
  detectFaces: detectFacesFull,
};
