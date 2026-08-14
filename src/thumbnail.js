const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { config } = require('./config');
const { mimeType } = require('./utils');

function cacheKey(...parts) {
  const hash = crypto.createHash('sha1').update(parts.join('|')).digest('hex');
  return path.join(config.thumbDir, hash.slice(0, 2), hash + '.webp');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function generateThumbFromBuffer(buffer, targetPath, { width } = {}) {
  ensureDir(path.dirname(targetPath));
  const size = width || config.thumbSize;
  await sharp(buffer, { failOn: 'none', animated: false })
    .rotate()
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: config.thumbQuality })
    .toFile(targetPath);
  return targetPath;
}

async function thumbExists(targetPath) {
  try {
    await fs.promises.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getThumbForFile(filePath) {
  const stat = await fs.promises.stat(filePath);
  const key = cacheKey('file', filePath, stat.size, stat.mtimeMs);
  if (!(await thumbExists(key))) {
    await generateThumbFromBuffer(await fs.promises.readFile(filePath), key);
  }
  return { path: key, mime: 'image/webp' };
}

async function getThumbForArchiveEntry(archivePath, entryName) {
  const { readEntryBuffer } = require('./archive');
  const stat = await fs.promises.stat(archivePath);
  const key = cacheKey('archive', archivePath, stat.size, stat.mtimeMs, entryName);
  if (!(await thumbExists(key))) {
    const buf = await readEntryBuffer(archivePath, archivePath, entryName);
    await generateThumbFromBuffer(buf, key);
  }
  return { path: key, mime: 'image/webp' };
}

module.exports = { getThumbForFile, getThumbForArchiveEntry, generateThumbFromBuffer, cacheKey };
