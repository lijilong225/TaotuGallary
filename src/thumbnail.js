const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const sharp = require('sharp');
const { config } = require('./config');
const { isVideoFile, mimeType } = require('./utils');

const VIDEO_CACHE_DIR = path.join(config.thumbDir, '..', 'videos');

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

function execFileAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 512 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} failed: ${stderr || err.message}`));
      else resolve({ stdout, stderr });
    });
  });
}

async function probeVideoSize(inputPath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json', inputPath,
    ]);
    const info = JSON.parse(stdout);
    const s = info.streams && info.streams[0];
    if (s && s.width && s.height) return { width: s.width, height: s.height };
  } catch (e) { /* fall through */ }
  return null;
}

function fitInside(srcW, srcH, max) {
  const ratio = Math.min(max / srcW, max / srcH);
  let w = Math.max(2, Math.round(srcW * ratio));
  let h = Math.max(2, Math.round(srcH * ratio));
  if (w % 2) w++;
  if (h % 2) h++;
  return { width: w, height: h };
}

async function generateThumbFromVideo(inputPath, targetPath, { width, dim } = {}) {
  ensureDir(path.dirname(targetPath));
  const size = width || config.thumbSize;
  const probe = dim || await probeVideoSize(inputPath);
  let w = size;
  let h = size;
  if (probe) {
    const fitted = fitInside(probe.width, probe.height, size);
    w = fitted.width;
    h = fitted.height;
  }
  const vf = `scale=${w}:${h}`;
  await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-y', '-ss', '1', '-i', inputPath,
    '-vframes', '1', '-vf', vf,
    '-q:v', '4', targetPath,
  ]);
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

async function getThumbForFile(filePath, width) {
  const stat = await fs.promises.stat(filePath);
  const w = width || config.thumbSize;
  const isVideo = isVideoFile(filePath);
  const dim = isVideo ? await probeVideoSize(filePath) : null;
  const dimSig = dim ? `${dim.width}x${dim.height}` : '';
  const key = cacheKey('file', filePath, stat.size, stat.mtimeMs, w, dimSig);
  if (!(await thumbExists(key))) {
    if (isVideo) {
      await generateThumbFromVideo(filePath, key, { width: w, dim });
    } else {
      await generateThumbFromBuffer(await fs.promises.readFile(filePath), key, { width: w });
    }
  }
  return { path: key, mime: 'image/webp' };
}

async function getThumbForArchiveEntry(archivePath, entryName, width) {
  const { readEntryBuffer } = require('./archive');
  const stat = await fs.promises.stat(archivePath);
  const w = width || config.thumbSize;
  const isVideo = isVideoFile(entryName);
  let dim = null;
  let video = null;
  if (isVideo) {
    video = await extractVideoToCache(archivePath, entryName);
    dim = await probeVideoSize(video);
  }
  const dimSig = dim ? `${dim.width}x${dim.height}` : '';
  const key = cacheKey('archive', archivePath, stat.size, stat.mtimeMs, entryName, w, dimSig);
  if (!(await thumbExists(key))) {
    if (isVideo) {
      await generateThumbFromVideo(video, key, { width: w, dim });
    } else {
      const buf = await readEntryBuffer(archivePath, archivePath, entryName);
      await generateThumbFromBuffer(buf, key, { width: w });
    }
  }
  return { path: key, mime: 'image/webp' };
}

function videoCacheFile(archivePath, entryName) {
  const stat = fs.statSync(archivePath);
  const hash = crypto.createHash('sha1').update(['video', archivePath, stat.size, stat.mtimeMs, entryName].join('|')).digest('hex');
  const ext = path.extname(entryName) || '.mp4';
  const file = path.join(VIDEO_CACHE_DIR, hash + ext);
  ensureDir(VIDEO_CACHE_DIR);
  return file;
}

async function extractVideoToCache(archivePath, entryName) {
  const { readEntryBuffer } = require('./archive');
  const target = videoCacheFile(archivePath, entryName);
  try {
    await fs.promises.stat(target);
    return target;
  } catch { /* not cached yet */ }
  const buf = await readEntryBuffer(archivePath, archivePath, entryName);
  await fs.promises.writeFile(target, buf);
  return target;
}

module.exports = {
  getThumbForFile,
  getThumbForArchiveEntry,
  extractVideoToCache,
  generateThumbFromBuffer,
  generateThumbFromVideo,
  cacheKey,
  mimeType,
};
