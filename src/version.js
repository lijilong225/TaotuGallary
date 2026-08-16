const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.resolve(__dirname, '..', 'version');

function getVersion() {
  try {
    const raw = fs.readFileSync(VERSION_FILE, 'utf8').trim();
    if (raw) return raw.startsWith('v') ? raw : 'v' + raw;
  } catch {}
  return 'v0.0.0';
}

module.exports.getVersion = getVersion;