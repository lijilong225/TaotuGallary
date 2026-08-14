const path = require('path');
const fs = require('fs');

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.avif', '.svg', '.ico', '.heic', '.heif'
]);

const ARCHIVE_EXTENSIONS = new Set(['.zip', '.rar']);

function isImageFile(name) {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function isArchiveFile(name) {
  return ARCHIVE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function mimeType(name) {
  const ext = path.extname(name).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
  };
  return map[ext] || 'application/octet-stream';
}

function isHiddenName(name) {
  return name.startsWith('.') || name === 'Thumbs.db' || name === 'desktop.ini';
}

function normalizeArchiveEntry(name) {
  return String(name).replace(/\\/g, '/');
}

module.exports = { isImageFile, isArchiveFile, mimeType, isHiddenName, normalizeArchiveEntry };
