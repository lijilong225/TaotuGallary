const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');

const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  galleryRoot: path.resolve(process.env.GALLERY_ROOT || '/gallery'),
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  thumbDir: process.env.THUMB_DIR || path.join(ROOT_DIR, 'data', 'thumbs'),
  thumbSize: parseInt(process.env.THUMB_SIZE || '320', 10),
  thumbQuality: parseInt(process.env.THUMB_QUALITY || '80', 10),
};

module.exports = { config, ROOT_DIR };
