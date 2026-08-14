const express = require('express');
const session = require('express-session');
const path = require('path');
const { config, ROOT_DIR } = require('./config');
const { ensureDefaultUser } = require('./auth');
const api = require('./routes/api');
const logger = require('./logger');
const { errorHandler, requestLogger, apiLimiter } = require('./middleware');
const { execSync } = require('child_process');

function checkBinary(cmd) {
  try {
    execSync(cmd + ' --version', { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

const app = express();

async function init() {
  try {
    await require('./auth').ensureDefaultUser();
  } catch (e) {
    logger.error('初始化默认用户失败', { error: e.message });
  }

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // 请求日志中间件 - 应在最前面
  app.use(requestLogger);

  app.use(express.json({ limit: '1mb' }));

  app.use(session({
    name: 'gal.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production', // 生产环境使用https
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }));

  // API路由速率限制
  app.use('/api', apiLimiter);
  
  app.use('/api', api);

  const publicDir = path.join(ROOT_DIR, 'public');
  app.use(express.static(publicDir, {
    maxAge: '1h',
    etag: false,
  }));

  app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  // 404处理
  app.use((req, res) => {
    res.status(404).json({ error: '未找到该请求' });
  });

  // 全局错误处理 - 应在最后
  app.use(errorHandler);

  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`服务器启动成功`, { 
      port: config.port, 
      galleryRoot: config.galleryRoot,
      nodeEnv: process.env.NODE_ENV || 'development',
    });
    if (!checkBinary('ffmpeg')) logger.warn('警告: 未找到ffmpeg - 视频缩略图生成可能失败');
    if (!checkBinary('bsdtar')) logger.warn('警告: 未找到bsdtar - RAR压缩包支持可能不可用');
  });
}

init().catch((err) => {
  logger.error('服务器启动失败', { error: err.message, stack: err.stack });
  process.exit(1);
});
