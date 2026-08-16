const fs = require('fs');
const path = require('path');
const express = require('express');
const { body, validationResult } = require('express-validator');
const { config } = require('../config');
const { verify } = require('../auth');
const gallery = require('../gallery');
const thumb = require('../thumbnail');
const preferences = require('../preferences');
const { mimeType, isImageFile, isArchiveFile, isVideoFile } = require('../utils');
const logger = require('../logger');
const { loginLimiter } = require('../middleware');

const router = express.Router();

const THUMB_SIZES = { s: 160, m: 240, l: 320 };

// 应用登录速率限制到整个路由
router.use(loginLimiter);

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

router.post('/login', [
  body('username').trim().notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { username, password } = req.body;
  try {
    const ok = await verify(username, password);
    if (ok) {
      req.session.user = username;
      logger.info('用户登录成功', { user: username });
      return res.json({ user: username });
    }
    logger.warn('登录失败 - 凭证错误', { username });
    return res.status(401).json({ error: '用户名或密码错误' });
  } catch (e) {
    logger.error('认证失败', { username, error: e.message });
    return res.status(500).json({ error: '认证失败' });
  }
});

// 修改密码端点已移除，账户密码由环境变量 ADMIN_USER / ADMIN_PASSWORD 设置

router.get('/preferences', requireAuth, (req, res) => {
  res.json(preferences.getPreferences(req.session.user));
});

router.put('/preferences', requireAuth, async (req, res, next) => {
  const { layout } = req.body || {};
  if (!preferences.VALID_LAYOUTS.includes(layout)) {
    return res.status(400).json({ error: '非法的布局模式' });
  }
  try {
    await preferences.setPreference(req.session.user, 'layout', layout);
    res.json({ layout });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  const user = req.session.user;
  req.session.destroy(() => {
    logger.info('用户登出', { user });
    res.json({ ok: true });
  });
});

router.get('/tree', requireAuth, async (req, res, next) => {
  try {
    res.json({ tree: await gallery.buildTree() });
  } catch (e) { next(e); }
});

router.get('/info', requireAuth, async (req, res, next) => {
  try {
    const info = await gallery.getMediaInfo(req.query.path || '', req.query.entry);
    res.json(info);
  } catch (e) {
    if (e.message === 'file not found') return res.status(404).json({ error: '文件不存在' });
    if (e.message === 'invalid path' || e.message === 'path outside gallery root') return res.status(403).json({ error: '访问被拒绝' });
    next(e);
  }
});

router.get('/browse', requireAuth, async (req, res, next) => {
  try {
    const p = req.query.path || '';
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
    res.json(await gallery.listGalleryDir(p, pageNum, pageSize));
  } catch (e) { next(e); }
});

router.get('/archive-images', requireAuth, async (req, res, next) => {
  try {
    const p = req.query.path || '';
    res.json(await gallery.listArchiveMedia(p));
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

    const width = THUMB_SIZES[req.query.size] || undefined;
    let result;
    if (isArchiveFile(filePath)) {
      if (!entry) return res.status(400).json({ error: '缺少 entry 参数' });
      result = await thumb.getThumbForArchiveEntry(filePath, entry, width);
    } else if (isImageFile(filePath) || isVideoFile(filePath)) {
      result = await thumb.getThumbForFile(filePath, width);
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

function sendVideoStream(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;
  const type = mimeType(filePath);

  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= total) end = total - 1;
      if (start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', end - start + 1);
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      return;
    }
  }
  res.setHeader('Content-Length', total);
  fs.createReadStream(filePath).pipe(res);
}

router.get('/video', requireAuth, async (req, res, next) => {
  try {
    const p = req.query.path || '';
    const entry = req.query.entry;
    const filePath = gallery.safeResolve(p);
    if (!gallery.exists(filePath)) throw new Error('file not found');

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return res.status(400).json({ error: '不能播放目录' });

    if (isArchiveFile(filePath)) {
      if (!entry) return res.status(400).json({ error: '缺少 entry 参数' });
      if (!isVideoFile(entry)) return res.status(400).json({ error: '压缩包内该条目不是视频' });
      const cached = await thumb.extractVideoToCache(filePath, entry);
      sendVideoStream(req, res, cached);
      return;
    }

    if (!isVideoFile(filePath)) return res.status(400).json({ error: '不支持的文件类型' });
    sendVideoStream(req, res, filePath);
  } catch (e) { next(e); }
});

module.exports = router;
