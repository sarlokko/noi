/**
 * Riconoscimento volti famiglia (Marco, Laura, Luca, Giorgia).
 * Richiede foto di riferimento in config/family/*.jpg
 */

const fs = require("fs");
const path = require("path");
const { ensureBackend } = require("./tfjs-cpu-shim");
const faceapi = require("@vladmandic/face-api");
const canvas = require("canvas");

faceapi.env.monkeyPatch({ Canvas: canvas.Canvas, Image: canvas.Image });

const ROOT = path.join(__dirname, "..");
const MODEL_PATH = path.join(ROOT, "node_modules/@vladmandic/face-api/model");
const DEFAULT_REF_DIR = path.join(ROOT, "config", "family");

let modelsLoaded = false;
let matcher = null;

async function loadModels() {
  if (modelsLoaded) return;
  await ensureBackend();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
  modelsLoaded = true;
}

async function loadImage(filePath) {
  return canvas.loadImage(filePath);
}

async function detectFaces(source) {
  const img = typeof source === "string" ? await loadImage(source) : source;
  return faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
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
    const faces = await detectFaces(full);
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
  const { minMatches = 1, minConfidence = 0.45 } = options;
  if (!matcher) return { familyScore: 0, matches: [], faceCount: 0 };

  const faces = await detectFaces(filePath);
  if (!faces.length) return { familyScore: 0, matches: [], faceCount: 0 };

  const matches = [];
  const matchedMembers = new Set();

  for (const face of faces) {
    if (face.detection.score < minConfidence) continue;
    const best = matcher.findBestMatch(face.descriptor);
    if (best.label === "unknown") continue;
    matches.push({ member: best.label, distance: best.distance, score: face.detection.score });
    matchedMembers.add(best.label);
  }

  const familyScore = matchedMembers.size >= minMatches ? matchedMembers.size * 100 + matches.length * 10 : 0;
  return { familyScore, matches, faceCount: faces.length, members: [...matchedMembers] };
}

async function extractReferenceFace(sourcePath, outPath) {
  await loadModels();
  const faces = await detectFaces(sourcePath);
  if (!faces.length) throw new Error(`Nessun volto in ${sourcePath}`);
  const best = faces.reduce((a, b) => (a.detection.score > b.detection.score ? a : b));
  const box = best.detection.box;
  const img = await loadImage(sourcePath);
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
  loadFamilyReferences,
  scoreFamilyPhoto,
  extractReferenceFace,
  detectFaces,
  loadModels,
};
