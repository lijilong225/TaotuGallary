const fs = require('fs');
const path = require('path');
const express = require('express');
const { config } = require('../config');
const { verify, ensureDefaultUser } = require('../auth');
const gallery = require('../gallery');
const thumb = require('../thumbnail');
const { mimeType, isImageFile, isArchiveFile } = require('../utils');

const router = express.Router();

function isAuth(req) {
  return req.session && req.session.user;
}

function requireAuth(req, res, next) {
  if (!isAuth(req)) return res.status(401).json({ error: '未登录' });
  next();
}

function sendFile(res, filePath, fallbackMime) {
  const stat = fs.statSync(filePath);
  res.setHeader('Content-Type', fallbackMime || mimeType(filePath));
  res.setHeader('Content-Length', stat.size);
  res.sendFile(path.resolve(filePath));
}

function sendRawImage(res, filePath, userPath) {
  const stat = fs.statSync(filePath);
  res.setHeader('Content-Type', mimeType(userPath || filePath));
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(path.resolve(filePath));
}

router.get('/ping', (req, res) => res.json({ ok: true }));

router.get('/me', (req, res) => {
  if (isAuth(req)) return res.json({ user: req.session.user });
  res.status(401).json({ error: '未登录' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  if (verify(username, password)) {
    req.session.user = username;
    return res.json({ user: username });
  }
  res.status(401).json({ error: '用户名或密码错误' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/tree', requireAuth, async (req, res, next) => {
  try {
    res.json({ tree: await gallery.buildTree() });
  } catch (e) { next(e); }
});

router.get('/browse', requireAuth, async (req, res, next) => {
  try {
    const p = req.query.path || '';
    res.json(await gallery.listGalleryDir(p));
  } catch (e) { next(e); }
});

router.get('/archive-images', requireAuth, async (req, res, next) => {
  try {
    const p = req.query.path || '';
    res.json({ images: await gallery.listArchiveImages(p) });
  } catch (e) { next(e); }
});

router.get('/thumb', requireAuth, async (req, res, next) => {
  try {
    const p = req.query.path || '';
    const entry = req.query.entry;
    const filePath = gallery.safeResolve(p);
    if (!gallery.exists(filePath)) throw new Error('file not found');

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return res.status(400).json({ error: '不能为目录生成缩略图' });

    let result;
    if (isArchiveFile(filePath)) {
      if (!entry) return res.status(400).json({ error: '缺少 entry 参数' });
      result = await thumb.getThumbForArchiveEntry(filePath, entry);
    } else if (isImageFile(filePath)) {
      result = await thumb.getThumbForFile(filePath);
    } else {
      return res.status(400).json({ error: '不支持的文件类型' });
    }
    sendFile(res, result.path, result.mime);
  } catch (e) { next(e); }
});

router.get('/image', requireAuth, async (req, res, next) => {
  try {
    const p = req.query.path || '';
    const entry = req.query.entry;
    const filePath = gallery.safeResolve(p);
    if (!gallery.exists(filePath)) throw new Error('file not found');

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return res.status(400).json({ error: '不能读取目录' });

    if (isArchiveFile(filePath)) {
      if (!entry) return res.status(400).json({ error: '缺少 entry 参数' });
      const { readEntryBuffer } = require('../archive');
      const buf = await readEntryBuffer(filePath, filePath, entry);
      res.setHeader('Content-Type', mimeType(entry));
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return res.send(buf);
    }

    if (!isImageFile(filePath)) return res.status(400).json({ error: '不支持的文件类型' });
    sendRawImage(res, filePath, filePath);
  } catch (e) { next(e); }
});

router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || '服务器错误' });
});

module.exports = router;
