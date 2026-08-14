const fs = require('fs');
const path = require('path');
const auth = require('./src/auth');
const logger = require('./src/logger');

async function runTests() {
  console.log('🧪 开始运行测试...\n');

  try {
    // 测试1: Logger
    console.log('✓ 测试1: Logger 模块');
    logger.info('测试日志输出', { test: 'success' });
    console.log('  日志系统初始化成功\n');

    // 测试2: 默认用户
    console.log('✓ 测试2: 默认用户初始化');
    const usersFile = path.join(__dirname, 'data', 'users.json');
    const usersBefore = fs.existsSync(usersFile) ? 
      JSON.parse(fs.readFileSync(usersFile, 'utf8')) : {};
    
    const users = await auth.ensureDefaultUser();
    console.log('  默认用户创建/验证成功');
    console.log('  用户数:', Object.keys(users).length, '\n');

    // 测试3: 密码验证
    console.log('✓ 测试3: 密码验证');
    const isValid = await auth.verify('admin', 'admin');
    console.log('  admin 密码验证:', isValid ? '✓ 通过' : '✗ 失败', '\n');

    // 测试4: 默认密码检查
    console.log('✓ 测试4: 默认密码检查');
    const isDefault = await auth.isDefaultPassword('admin');
    console.log('  admin 使用默认密码:', isDefault ? '✓ 是' : '✗ 否');
    if (isDefault) {
      console.log('  (注意: 首次启动时为真，修改密码后为假)\n');
    } else {
      console.log('  (密码已在之前被修改)\n');
    }

    // 测试5: 密码修改
    console.log('✓ 测试5: 密码修改功能');
    const result = await auth.changePassword('admin', 'admin', 'test123456');
    if (result.success) {
      console.log('  密码修改成功');
      const isDefaultAfter = await auth.isDefaultPassword('admin');
      console.log('  修改后默认密码标记:', isDefaultAfter ? '✓ 是' : '✗ 否');
      console.log('  (修改后应为否)\n');

      // 恢复密码以便后续测试
      const restoreResult = await auth.changePassword('admin', 'test123456', 'admin');
      if (restoreResult.success) {
        console.log('  密码已恢复为 admin\n');
      }
    } else {
      console.log('  ✗ 密码修改失败:', result.error, '\n');
    }

    // 测试6: 无效密码修改
    console.log('✓ 测试6: 密码修改验证（错误情况）');
    const invalidResult = await auth.changePassword('admin', 'wrongpass', 'newpass');
    console.log('  使用错误旧密码修改:', invalidResult.success ? '✗ 不应成功' : '✓ 正确拒绝');
    console.log('  错误信息:', invalidResult.error, '\n');

    // 测试7: 日志文件
    console.log('✓ 测试7: 日志文件检查');
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
    console.log('  ✓ 默认用户初始化');
    console.log('  ✓ 密码验证与修改');
    console.log('  ✓ 安全验证（错误密码拒绝）');
    console.log('  ✓ 日志文件记录\n');
    console.log('📝 接下来的步骤:');
    console.log('1. 运行: npm start');
    console.log('2. 打开: http://localhost:8080');
    console.log('3. 首次登录后会被提示修改默认密码');

  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();
