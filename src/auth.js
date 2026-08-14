const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { config } = require('./config');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function ensureDataDir() {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
}

function loadUsers() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function ensureDefaultUser() {
  const users = loadUsers();
  if (!users[config.adminUser]) {
    users[config.adminUser] = bcrypt.hashSync(config.adminPassword, 10);
    saveUsers(users);
  }
  return users;
}

function verify(username, password) {
  const users = loadUsers();
  const hash = users[username];
  if (!hash) return false;
  return bcrypt.compareSync(password, hash);
}

module.exports = { ensureDefaultUser, verify };
