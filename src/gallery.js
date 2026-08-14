const fs = require('fs');
const path = require('path');
const { config } = require('./config');
const { isImageFile, isArchiveFile, isHiddenName, isVideoFile } = require('./utils');
const { listEntries } = require('./archive');

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

async function listGalleryDir(userPath) {
  const dir = safeResolve(userPath);
  if (!(await isDirectory(dir))) throw new Error('not a directory');

  const entries = await fs.promises.readdir(dir);
  const folders = [];
  const archives = [];
  const images = [];
  const videos = [];

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
  return { folders: sortBy(folders), archives: sortBy(archives), images: sortBy(images), videos: sortBy(videos) };
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

module.exports = { buildTree, listGalleryDir, listArchiveMedia, safeResolve, toRel, exists, isDirectory };
