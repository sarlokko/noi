const path = require("path");
const sharp = require("sharp");

function getExportSettings(config) {
  const exp = config.export || {};
  return {
    webMax: exp.webMaxSize ?? 2200,
    webQ: exp.webQuality ?? 84,
    thumbMax: exp.thumbMaxSize ?? 600,
    thumbQ: exp.thumbQuality ?? 80,
    origMax: exp.originalMaxSize ?? 0,
    origQ: exp.originalQuality ?? 92,
  };
}

async function exportPhotoFiles(sourcePath, outDirs, id, settings) {
  const webName = `${id}.webp`;
  const thumbName = `${id}-thumb.webp`;
  const origName = `${id}.jpg`;

  await sharp(sourcePath)
    .rotate()
    .resize(settings.webMax, settings.webMax, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: settings.webQ, effort: 4 })
    .toFile(path.join(outDirs.photos, webName));

  await sharp(sourcePath)
    .rotate()
    .resize(settings.thumbMax, settings.thumbMax, { fit: "cover", position: "attention" })
    .webp({ quality: settings.thumbQ, effort: 4 })
    .toFile(path.join(outDirs.thumbs, thumbName));

  let original = sharp(sourcePath).rotate();
  if (settings.origMax > 0) {
    original = original.resize(settings.origMax, settings.origMax, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  await original
    .jpeg({ quality: settings.origQ, mozjpeg: true })
    .toFile(path.join(outDirs.originals, origName));

  const meta = await sharp(path.join(outDirs.originals, origName)).metadata();

  return {
    id,
    title: path.basename(sourcePath, path.extname(sourcePath)).replace(/[_-]+/g, " "),
    width: meta.width,
    height: meta.height,
    orientation: meta.width >= meta.height ? "landscape" : "portrait",
    web: `photos/${webName}`,
    thumb: `thumbs/${thumbName}`,
    original: `originals/${origName}`,
    aspectRatio: +(meta.width / meta.height).toFixed(3),
  };
}

module.exports = { getExportSettings, exportPhotoFiles };
