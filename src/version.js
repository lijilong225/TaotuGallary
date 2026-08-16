const { execSync } = require('child_process');
const path = require('path');

let version = 'v0.0.0';

try {
  version = execSync('git describe --tags --always --abbrev=0', {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
  if (version && !version.startsWith('v')) version = 'v' + version;
} catch {
  try {
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    if (pkg.version) version = 'v' + pkg.version;
  } catch {}
}

module.exports = version;