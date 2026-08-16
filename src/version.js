const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.resolve(__dirname, '..', 'version');

let version = 'v0.0.0';

try {
  const raw = fs.readFileSync(VERSION_FILE, 'utf8').trim();
  if (raw) version = raw.startsWith('v') ? raw : 'v' + raw;
} catch {}

module.exports = version;