/**
 * Riconoscimento volti famiglia (Marco, Laura, Luca, Giorgia).
 * Single-pass: una sola decodifica + TinyFaceDetector con landmark/descriptor.
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
const MIN_REF_SIZE = 400;

const SETTINGS = {
  detectMaxSize: 640,
  tinyInputSize: 416,
  tinyScoreThreshold: 0.35,
  refScoreThreshold: 0.2,
  minConfidence: 0.45,
};

let modelsLoaded = false;
let matcher = null;

function configureFamilyMatcher(options = {}) {
  if (options.matchDetectMaxSize) SETTINGS.detectMaxSize = options.matchDetectMaxSize;
  if (options.quickDetectMaxSize) SETTINGS.detectMaxSize = options.quickDetectMaxSize;
  Object.assign(SETTINGS, options);
}

async function loadModels() {
  if (modelsLoaded) return;
  await ensureBackend();
  await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
  modelsLoaded = true;
}

async function loadImageCanvas(source, maxSize = SETTINGS.detectMaxSize) {
  if (source instanceof canvas.Canvas) return source;

  let buffer;
  if (typeof source === "string") {
    buffer = await sharp(source)
      .rotate()
      .resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } else if (Buffer.isBuffer(source)) {
    buffer = await sharp(source)
      .rotate()
      .resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } else {
    throw new Error(`loadImageCanvas: sorgente non supportata (${typeof source})`);
  }

  const img = await canvas.loadImage(buffer);
  const c = canvas.createCanvas(img.width, img.height);
  c.getContext("2d").drawImage(img, 0, 0);
  return c;
}

function tinyOptions(scoreThreshold = SETTINGS.tinyScoreThreshold) {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: SETTINGS.tinyInputSize,
    scoreThreshold,
  });
}

async function detectFamilyFaces(source, scoreThreshold = SETTINGS.tinyScoreThreshold) {
  const img =
    source instanceof canvas.Canvas ? source : await loadImageCanvas(source);
  return faceapi
    .detectAllFaces(img, tinyOptions(scoreThreshold))
    .withFaceLandmarks(true)
    .withFaceDescriptors();
}

function sidecarPath(imagePath) {
  return imagePath.replace(/\.(jpe?g|png|webp)$/i, ".json");
}

function loadSidecar(imagePath) {
  const jsonPath = sidecarPath(imagePath);
  if (!fs.existsSync(jsonPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    if (!Array.isArray(data.descriptor)) return null;
    return data;
  } catch {
    return null;
  }
}

function saveSidecar(imagePath, name, descriptor) {
  const jsonPath = sidecarPath(imagePath);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        name,
        descriptor: Array.from(descriptor),
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

async function detectReferenceFaces(imagePath) {
  let faces = await detectFamilyFaces(imagePath);
  if (faces.length) return faces;

  const upscaled = await sharp(imagePath)
    .rotate()
    .resize(MIN_REF_SIZE, MIN_REF_SIZE, { fit: "inside", withoutEnlargement: false })
    .jpeg({ quality: 90 })
    .toBuffer();
  faces = await detectFamilyFaces(upscaled, SETTINGS.refScoreThreshold);
  return faces;
}

async function detectBestFace(sourcePath) {
  await loadModels();
  const normalized = await sharp(sourcePath).rotate().jpeg({ quality: 90 }).toBuffer();
  const rotations = [0, 90, 180, 270];
  let best = null;

  for (const deg of rotations) {
    const buffer =
      deg === 0 ? normalized : await sharp(normalized).rotate(deg).jpeg({ quality: 90 }).toBuffer();
    const faces = await detectFamilyFaces(buffer, SETTINGS.refScoreThreshold);
    if (!faces.length) continue;
    const top = faces.reduce((a, b) => (a.detection.score > b.detection.score ? a : b));
    if (!best || top.detection.score > best.face.detection.score) {
      best = { face: top, rotation: deg, buffer };
    }
  }

  return best;
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
    const sidecar = loadSidecar(full);

    if (sidecar) {
      labeled.push(new faceapi.LabeledFaceDescriptors(name, [new Float32Array(sidecar.descriptor)]));
      console.log(`  Riferimento: ${name} (${file} + sidecar)`);
      continue;
    }

    const faces = await detectReferenceFaces(full);
    if (!faces.length) {
      console.warn(`  Nessun volto in riferimento: ${file}`);
      console.warn(`    Rigenera: npm run family:setup -- ${name} "percorso\\foto.jpg"`);
      continue;
    }
    const best = faces.reduce((a, b) => (a.detection.score > b.detection.score ? a : b));
    saveSidecar(full, name, best.descriptor);
    labeled.push(new faceapi.LabeledFaceDescriptors(name, [best.descriptor]));
    console.log(`  Riferimento: ${name} (${file}, sidecar creato)`);
  }

  if (!labeled.length) return null;
  matcher = new faceapi.FaceMatcher(labeled, threshold);
  return matcher;
}

function matchFaces(faces, options = {}) {
  const minMatches = options.minMatches ?? 1;
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
    hasFaces: faces.length > 0,
  };
}

function scoreDescriptor(descriptor, options = {}) {
  if (!matcher) {
    return { familyScore: 0, matches: [], faceCount: 1, members: [], hasFaces: true };
  }
  const best = matcher.findBestMatch(descriptor);
  const members = best.label !== "unknown" ? [best.label] : [];
  const familyScore = members.length >= (options.minMatches ?? 1) ? 100 : 0;
  return {
    familyScore,
    matches: members.length ? [{ member: best.label, distance: best.distance, score: 1 }] : [],
    faceCount: 1,
    members,
    hasFaces: true,
  };
}

async function scoreFamilyPhoto(filePath, options = {}) {
  if (!matcher) {
    return { familyScore: 0, matches: [], faceCount: 0, members: [], hasFaces: false };
  }

  try {
    const faces = await detectFamilyFaces(filePath);
    if (!faces.length) {
      return { familyScore: 0, matches: [], faceCount: 0, members: [], hasFaces: false };
    }
    return matchFaces(faces, options);
  } catch {
    return { familyScore: 0, matches: [], faceCount: 0, members: [], hasFaces: false };
  }
}

async function scoreReferenceFile(imagePath, expectedName, options = {}) {
  const sidecar = loadSidecar(imagePath);
  if (sidecar) {
    return scoreDescriptor(new Float32Array(sidecar.descriptor), options);
  }
  const result = await scoreFamilyPhoto(imagePath, options);
  if (result.members.includes(expectedName)) return result;

  const faces = await detectReferenceFaces(imagePath);
  if (!faces.length) return result;
  return matchFaces(faces, { ...options, minConfidence: 0.2 });
}

async function scoreFamilyCanvas(imgCanvas, options = {}) {
  if (!matcher) {
    return { familyScore: 0, matches: [], faceCount: 0, members: [], hasFaces: false };
  }

  try {
    const faces = await faceapi
      .detectAllFaces(imgCanvas, tinyOptions())
      .withFaceLandmarks(true)
      .withFaceDescriptors();
    if (!faces.length) {
      return { familyScore: 0, matches: [], faceCount: 0, members: [], hasFaces: false };
    }
    return matchFaces(faces, options);
  } catch {
    return { familyScore: 0, matches: [], faceCount: 0, members: [], hasFaces: false };
  }
}

async function extractReferenceFace(sourcePath, outPath) {
  const best = await detectBestFace(sourcePath);
  if (!best) throw new Error(`Nessun volto in ${sourcePath} (provate anche rotazioni 0/90/180/270°)`);

  const { face, rotation, buffer } = best;
  const box = face.detection.box;
  const img = await loadImageCanvas(buffer);
  const pad = Math.round(Math.max(box.width, box.height) * 0.4);
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  let w = Math.min(img.width - x, Math.ceil(box.width + pad * 2));
  let h = Math.min(img.height - y, Math.ceil(box.height + pad * 2));

  const minDim = Math.min(w, h);
  if (minDim < MIN_REF_SIZE) {
    const scale = MIN_REF_SIZE / minDim;
    w = Math.ceil(w * scale);
    h = Math.ceil(h * scale);
  }

  const c = canvas.createCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, x, y, Math.min(img.width - x, Math.ceil(box.width + pad * 2)), Math.min(img.height - y, Math.ceil(box.height + pad * 2)), 0, 0, w, h);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, c.toBuffer("image/jpeg", { quality: 0.92 }));

  const name = path.basename(outPath, path.extname(outPath)).toLowerCase();
  saveSidecar(outPath, name, face.descriptor);

  if (rotation !== 0) {
    console.log(`  (foto ruotata di ${rotation}° per rilevare il volto)`);
  }
}

module.exports = {
  configureFamilyMatcher,
  loadFamilyReferences,
  scoreFamilyPhoto,
  scoreReferenceFile,
  scoreFamilyCanvas,
  loadImageCanvas,
  extractReferenceFace,
  loadSidecar,
  saveSidecar,
  loadModels,
  detectFaces: detectFamilyFaces,
};
