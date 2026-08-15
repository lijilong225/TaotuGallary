const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { config } = require('./config');
const { isImageFile, isArchiveFile, isHiddenName, isVideoFile, normalizeArchiveEntry } = require('./utils');
const { listEntries, readEntryBuffer } = require('./archive');

function toRel(p) {
  const rel = path.relative(config.galleryRoot, p);
  if (rel.startsWith('..')) throw new Error('path outside gallery root');
  return rel.split(path.sep).join('/');
}

function safeResolve(userPath) {
  const target = path.resolve(config.galleryRoot, userPath || '.');
  const rel = path.relative(config.galleryRoot, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('invalid path');
  return target;
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(p) {
  try {
    return (await fs.promises.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function buildTree() {
  async function walk(dir) {
    let names;
    try {
      names = await fs.promises.readdir(dir);
    } catch {
      return [];
    }
    const out = [];
    for (const name of names) {
      if (isHiddenName(name)) continue;
      const full = path.join(dir, name);
      const stat = await fs.promises.stat(full).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) {
        out.push({
          name,
          rel: toRel(full),
          type: 'dir',
          children: await walk(full),
        });
      } else if (isArchiveFile(name)) {
        out.push({
          name,
          rel: toRel(full),
          type: 'archive',
          children: [],
        });
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    return out;
  }
  return walk(config.galleryRoot);
}

async function listGalleryDir(userPath, pageNum = 1, pageSize = 50) {
  const dir = safeResolve(userPath);
  if (!(await isDirectory(dir))) throw new Error('not a directory');

  const entries = await fs.promises.readdir(dir);
  let folders = [];
  let archives = [];
  let images = [];
  let videos = [];

  for (const name of entries) {
    if (isHiddenName(name)) continue;
    const full = path.join(dir, name);
    const stat = await fs.promises.stat(full).catch(() => null);
    if (!stat) continue;
    if (stat.isDirectory()) {
      const childCount = await countChildImages(full);
      folders.push({ name, rel: toRel(full), type: 'dir', count: childCount, mtime: stat.mtimeMs });
    } else if (isArchiveFile(name)) {
      archives.push({ name, rel: toRel(full), type: 'archive', mtime: stat.mtimeMs });
    } else if (isVideoFile(name)) {
      videos.push({ name, rel: toRel(full), type: 'video', mtime: stat.mtimeMs });
    } else if (isImageFile(name)) {
      images.push({ name, rel: toRel(full), type: 'image', mtime: stat.mtimeMs });
    }
  }

  const sortBy = (arr) => arr.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  folders = sortBy(folders);
  archives = sortBy(archives);
  images = sortBy(images);
  videos = sortBy(videos);

  // 文件夹和压缩包不分页，直接返回
  // 图片和视频进行分页
  const allMedia = [...images, ...videos];
  const totalCount = allMedia.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const page = Math.max(1, Math.min(pageNum, totalPages || 1));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pagedMedia = allMedia.slice(start, end);

  // 按照原始类型分类分页后的媒体
  const pagedImages = pagedMedia.filter(e => e.type === 'image');
  const pagedVideos = pagedMedia.filter(e => e.type === 'video');

  return {
    folders,
    archives,
    images: pagedImages,
    videos: pagedVideos,
    pagination: {
      pageNum: page,
      pageSize: pageSize,
      totalCount: totalCount,
      totalPages: totalPages,
    },
  };
}

async function countChildImages(dir) {
  let count = 0;
  try {
    const entries = await fs.promises.readdir(dir);
    for (const name of entries) {
      if (isHiddenName(name)) continue;
      const full = path.join(dir, name);
      const stat = await fs.promises.stat(full).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) count += await countChildImages(full);
      else if (isImageFile(name)) count += 1;
    }
  } catch { /* ignore */ }
  return count;
}

function formatSize(bytes) {
  if (bytes == null || isNaN(bytes) || bytes < 0) return '-';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
}

function formatTime(ms) {
  if (!ms) return '-';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function imageDimensionsFromFile(filePath) {
  try {
    const meta = await sharp(filePath, { failOn: 'none' }).metadata();
    return { width: meta.width, height: meta.height };
  } catch {
    return {};
  }
}

async function imageDimensionsFromBuffer(buf) {
  try {
    const meta = await sharp(buf, { failOn: 'none' }).metadata();
    return { width: meta.width, height: meta.height };
  } catch {
    return {};
  }
}

function mediaType(name) {
  if (isVideoFile(name)) return 'video';
  if (isImageFile(name)) return 'image';
  return 'file';
}

async function getMediaInfo(userPath, entryName) {
  const full = safeResolve(userPath);
  if (!exists(full)) throw new Error('file not found');

  if (entryName) {
    const entry = normalizeArchiveEntry(entryName);
    const entries = await listEntries(full, full);
    const target = entries.find(e => normalizeArchiveEntry(e.name) === entry && !e.isDirectory);
    if (!target) throw new Error('file not found');
    const info = {
      name: path.basename(entry),
      path: userPath,
      entry,
      location: 'archive',
      archiveName: path.basename(full),
      type: mediaType(entry),
      sizeBytes: target.size != null ? target.size : null,
      sizeText: formatSize(target.size),
      mtime: target.mtime,
      mtimeText: formatTime(target.mtime),
    };
    if (info.type === 'image') {
      const buf = await readEntryBuffer(full, full, entry);
      Object.assign(info, await imageDimensionsFromBuffer(buf));
    }
    return info;
  }

  const stat = await fs.promises.stat(full);
  const info = {
    name: path.basename(full),
    path: userPath,
    location: 'filesystem',
    type: mediaType(full),
    sizeBytes: stat.size,
    sizeText: formatSize(stat.size),
    mtime: stat.mtimeMs,
    mtimeText: formatTime(stat.mtimeMs),
  };
  if (info.type === 'image') {
    Object.assign(info, await imageDimensionsFromFile(full));
  }
  return info;
}

async function listArchiveMedia(archiveRel) {
  const full = safeResolve(archiveRel);
  if (!exists(full)) throw new Error('archive not found');
  const entries = await listEntries(full, full);
  const media = entries.filter(e => !e.isDirectory && (isImageFile(e.name) || isVideoFile(e.name)));
  const images = [];
  const videos = [];
  for (const e of media) {
    if (isVideoFile(e.name)) videos.push({ name: e.name, entry: e.name, type: 'video', mtime: e.mtime });
    else images.push({ name: e.name, entry: e.name, type: 'image', mtime: e.mtime });
  }
  return { images, videos };
}

module.exports = { buildTree, listGalleryDir, listArchiveMedia, getMediaInfo, safeResolve, toRel, exists, isDirectory };
