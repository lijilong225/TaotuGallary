const { execFile } = require('child_process');
const AdmZip = require('adm-zip');
const { normalizeArchiveEntry } = require('./utils');

function execFileAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 512 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} failed: ${stderr || err.message}`));
      else resolve({ stdout, stderr });
    });
  });
}

function isRar(name) {
  return name.toLowerCase().endsWith('.rar');
}

async function listEntries(filePath, ext) {
  if (isRar(ext)) {
    const { stdout } = await execFileAsync('bsdtar', ['-tf', filePath]);
    return stdout.split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => ({
        name: normalizeArchiveEntry(l),
        isDirectory: l.endsWith('/'),
      }));
  }
  const zip = new AdmZip(filePath);
  return zip.getEntries().map(e => ({
    name: normalizeArchiveEntry(e.entryName),
    isDirectory: e.isDirectory,
    size: e.header.size,
  }));
}

async function readEntryBuffer(filePath, ext, entryName) {
  const entry = normalizeArchiveEntry(entryName);
  if (isRar(ext)) {
    const { stdout } = await execFileAsync('bsdtar', ['-xOf', filePath, entry], { encoding: 'buffer' });
    return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  }
  const zip = new AdmZip(filePath);
  const found = zip.getEntries().find(e => normalizeArchiveEntry(e.entryName) === entry);
  if (!found) throw new Error(`archive entry not found: ${entry}`);
  return found.getData();
}

module.exports = { listEntries, readEntryBuffer };
