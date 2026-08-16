const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// 登录端点速率限制 - 防止暴力破解
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 30, // 每IP 15分钟最多30次尝试
  message: '登录尝试过多，请15分钟后再试',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 跳过非登录请求
    return req.method !== 'POST' || !req.path.includes('/login');
  },
  handler: (req, res) => {
    logger.warn('登录尝试过多', { ip: req.ip, path: req.path });
    res.status(429).json({ error: '登录尝试过多，请15分钟后再试' });
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
});

// API通用速率限制
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 600, // 每IP每分钟最多600次请求
  message: '请求过于频繁',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 跳过GET /ping请求
    return req.method === 'GET' && req.path === '/api/ping';
  },
  handler: (req, res) => {
    logger.warn('API请求过于频繁', { ip: req.ip, path: req.path, user: req.session?.user });
    res.status(429).json({ error: '请求过于频繁，请稍候再试' });
  },
  keyGenerator: (req) => {
    // 已认证用户按用户ID限制，未认证用户按IP限制
    return req.session?.user || (req.ip || req.connection.remoteAddress);
  },
});

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  // 路径遍历或安全错误
  if (err.message && err.message.includes('outside gallery root')) {
    logger.warn('尝试访问根目录外的文件', { ip: req.ip, path: req.path, user: req.session?.user, error: err.message });
    return res.status(403).json({ error: '访问被拒绝' });
  }

  // 文件不存在
  if (err.code === 'ENOENT') {
    return res.status(404).json({ error: '文件不存在' });
  }

  // 权限错误
  if (err.code === 'EACCES') {
    logger.warn('权限被拒绝', { ip: req.ip, path: req.path, user: req.session?.user });
    return res.status(403).json({ error: '权限被拒绝' });
  }

  // 其他错误
  logger.error('请求处理错误', {
    ip: req.ip,
    path: req.path,
    query: req.query,
    method: req.method,
    user: req.session?.user,
    error: err.message,
    stack: err.stack,
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
  });
};

// 请求日志中间件
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    logger[level]('HTTP请求', {
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      user: req.session?.user,
    });
  });

  next();
};

module.exports = {
  loginLimiter,
  apiLimiter,
  errorHandler,
  requestLogger,
};
