const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const logger = require('./logger');
const { config } = require('./config');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

async function ensureDataDir() {
  try { await fs.mkdir(path.dirname(USERS_FILE), { recursive: true }); } catch (e) { /* ignore */ }
}

async function loadUsers() {
  await ensureDataDir();
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveUsers(users) {
  await ensureDataDir();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function ensureDefaultUser() {
  const users = await loadUsers();
  if (!users[config.adminUser]) {
    users[config.adminUser] = {
      hash: bcrypt.hashSync(config.adminPassword, 10),
      isDefault: true, // 标记为默认密码
      createdAt: new Date().toISOString(),
    };
    await saveUsers(users);
    logger.info('创建默认管理员账号', { user: config.adminUser });
  } else if (users[config.adminUser].isDefault === true) {
    // 保持isDefault标记
  } else if (typeof users[config.adminUser] === 'string') {
    // 迁移旧格式
    users[config.adminUser] = {
      hash: users[config.adminUser],
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    await saveUsers(users);
  }
  return users;
}

async function verify(username, password) {
  const users = await loadUsers();
  const user = users[username];
  if (!user) return false;

  const hash = typeof user === 'string' ? user : user.hash;
  return await bcrypt.compare(password, hash);
}

async function isDefaultPassword(username) {
  const users = await loadUsers();
  const user = users[username];
  if (!user) return false;
  return user.isDefault === true;
}

async function changePassword(username, oldPassword, newPassword) {
  // 验证旧密码
  const valid = await verify(username, oldPassword);
  if (!valid) return { success: false, error: '当前密码不正确' };

  // 验证新密码强度（至少6个字符，包含字母和数字）
  if (newPassword.length < 6) return { success: false, error: '新密码至少6个字符' };
  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return { success: false, error: '新密码必须包含字母和数字' };
  }

  try {
    const users = await loadUsers();
    const user = users[username];
    if (!user) return { success: false, error: '用户不存在' };

    user.hash = bcrypt.hashSync(newPassword, 10);
    user.isDefault = false;
    user.updatedAt = new Date().toISOString();

    await saveUsers(users);
    logger.info('用户修改密码', { user: username });

    return { success: true };
  } catch (e) {
    logger.error('修改密码失败', { user: username, error: e.message });
    return { success: false, error: '修改密码失败' };
  }
}

module.exports = { ensureDefaultUser, verify, isDefaultPassword, changePassword };
