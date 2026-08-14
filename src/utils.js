const path = require('path');
const fs = require('fs');

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.avif', '.svg', '.ico', '.heic', '.heif'
]);

const ARCHIVE_EXTENSIONS = new Set(['.zip', '.rar']);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.flv',
  '.mpg', '.mpeg', '.m2ts', '.ts', '.3gp', '.ogv', '.ogg', '.rmvb', '.f4v',
]);

function isVideoFile(name) {
  return VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase());
}

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
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.mpg': 'video/mpeg',
    '.mpeg': 'video/mpeg',
    '.m2ts': 'video/mp2t',
    '.ts': 'video/mp2t',
    '.3gp': 'video/3gpp',
    '.ogv': 'video/ogg',
    '.ogg': 'video/ogg',
  };
  return map[ext] || 'application/octet-stream';
}

function isHiddenName(name) {
  return name.startsWith('.') || name === 'Thumbs.db' || name === 'desktop.ini';
}

function normalizeArchiveEntry(name) {
  return String(name).replace(/\\/g, '/');
}

module.exports = { isImageFile, isArchiveFile, isVideoFile, mimeType, isHiddenName, normalizeArchiveEntry };
