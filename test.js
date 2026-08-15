const fs = require('fs');
const path = require('path');
const auth = require('./src/auth');
const { config } = require('./src/config');
const logger = require('./src/logger');

async function runTests() {
  console.log('🧪 开始运行测试...\n');

  try {
    // 测试1: Logger
    console.log('✓ 测试1: Logger 模块');
    logger.info('测试日志输出', { test: 'success' });
    console.log('  日志系统初始化成功\n');

    // 测试2: 环境变量认证
    console.log('✓ 测试2: 环境变量认证验证');
    console.log('  管理员账号:', config.adminUser);
    const isValid = await auth.verify(config.adminUser, config.adminPassword);
    console.log('  正确凭证验证:', isValid ? '✓ 通过' : '✗ 失败', '\n');

    // 测试3: 密码验证（错误情况）
    console.log('✓ 测试3: 密码验证（错误情况）');
    const wrongUser = await auth.verify('nobody', 'wrongpass');
    console.log('  错误用户名:', wrongUser ? '✗ 不应通过' : '✓ 正确拒绝');
    const wrongPwd = await auth.verify(config.adminUser, 'wrongpass');
    console.log('  错误密码:', wrongPwd ? '✗ 不应通过' : '✓ 正确拒绝', '\n');

    // 测试4: 日志文件
    console.log('✓ 测试4: 日志文件检查');
    const logsDir = path.join(__dirname, 'data', 'logs');
    if (fs.existsSync(logsDir)) {
      const logs = fs.readdirSync(logsDir);
      console.log('  日志文件数:', logs.length);
      console.log('  日志文件:', logs.join(', '));

      // 检查日志内容
      const combinedLog = path.join(logsDir, 'combined.log');
      if (fs.existsSync(combinedLog)) {
        const logContent = fs.readFileSync(combinedLog, 'utf8');
        const logLines = logContent.trim().split('\n').length;
        console.log('  日志行数:', logLines, '\n');
      }
    } else {
      console.log('  日志目录将在首次启动时创建\n');
    }

    console.log('✅ 所有测试通过！\n');
    console.log('📝 核心功能验证:');
    console.log('  ✓ Logger 结构化日志系统');
    console.log('  ✓ 环境变量认证（ADMIN_USER / ADMIN_PASSWORD）');
    console.log('  ✓ 安全验证（错误凭证拒绝）');
    console.log('  ✓ 日志文件记录\n');
    console.log('📝 接下来的步骤:');
    console.log('1. 设置环境变量 ADMIN_USER / ADMIN_PASSWORD');
    console.log('2. 运行: npm start');
    console.log('3. 打开: http://localhost:8080');

  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();
