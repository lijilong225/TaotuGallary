const fs = require('fs');
const path = require('path');
const express = require('express');
const { body, validationResult } = require('express-validator');
const { config } = require('../config');
const { verify, isDefaultPassword, changePassword } = require('../auth');
const gallery = require('../gallery');
const thumb = require('../thumbnail');
const { mimeType, isImageFile, isArchiveFile, isVideoFile } = require('../utils');
const logger = require('../logger');
const { loginLimiter, csrfProtection } = require('../middleware');

const router = express.Router();

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

// 获取CSRF令牌
router.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

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
      const needsPasswordChange = await isDefaultPassword(username);
      logger.info('用户登录成功', { user: username });
      return res.json({ user: username, needsPasswordChange });
    }
    logger.warn('登录失败 - 凭证错误', { username });
    return res.status(401).json({ error: '用户名或密码错误' });
  } catch (e) {
    logger.error('认证失败', { username, error: e.message });
    return res.status(500).json({ error: '认证失败' });
  }
});

// 修改密码 - 需要CSRF保护
router.post('/change-password', csrfProtection, [
  body('oldPassword').notEmpty().withMessage('当前密码不能为空'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6个字符'),
], requireAuth, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { oldPassword, newPassword } = req.body;
  const username = req.session.user;

  try {
    const result = await changePassword(username, oldPassword, newPassword);
    if (result.success) {
      logger.info('用户修改密码成功', { user: username });
      return res.json({ success: true });
    }
    return res.status(400).json({ error: result.error });
  } catch (e) {
    logger.error('修改密码异常', { user: username, error: e.message });
    return res.status(500).json({ error: '修改密码失败' });
  }
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

    let result;
    if (isArchiveFile(filePath)) {
      if (!entry) return res.status(400).json({ error: '缺少 entry 参数' });
      result = await thumb.getThumbForArchiveEntry(filePath, entry);
    } else if (isImageFile(filePath) || isVideoFile(filePath)) {
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
