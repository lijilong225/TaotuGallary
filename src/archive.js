const { execFile } = require('child_process');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { normalizeArchiveEntry } = require('./utils');

const entriesCache = new Map();
const ENTRIES_CACHE_TTL = 30 * 1000;

function getCachedEntries(filePath) {
  try {
    const mtime = fs.statSync(filePath).mtimeMs;
    const key = filePath + '@' + mtime;
    const c = entriesCache.get(key);
    if (c && Date.now() - c.ts < ENTRIES_CACHE_TTL) return c.data;
  } catch { /* ignore */ }
  return null;
}

function setCachedEntries(filePath, data) {
  try {
    const mtime = fs.statSync(filePath).mtimeMs;
    const key = filePath + '@' + mtime;
    entriesCache.set(key, { data, ts: Date.now() });
  } catch { /* ignore */ }
}

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

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function parseBsdtarTime(fields) {
  for (let i = 0; i < fields.length; i++) {
    const m = MONTHS[fields[i]];
    if (m === undefined) continue;
    const day = parseInt(fields[i + 1], 10);
    const tok = fields[i + 2];
    if (isNaN(day) || !tok) return null;
    const now = new Date();
    let year = now.getFullYear();
    let hour = 0;
    let min = 0;
    if (tok.includes(':')) {
      const [hh, mm] = tok.split(':').map(Number);
      hour = hh || 0;
      min = mm || 0;
    } else {
      year = parseInt(tok, 10) || year;
    }
    return new Date(year, m, day, hour, min).getTime();
  }
  return null;
}

async function listEntries(filePath, ext) {
  const cached = getCachedEntries(filePath);
  if (cached) return cached;

  let result;
  if (isRar(ext)) {
    const { stdout } = await execFileAsync('bsdtar', ['-tvf', filePath]);
    result = stdout.split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => {
        const fields = l.split(' ');
        let time = null;
        let name = '';
        for (let i = 0; i < fields.length; i++) {
          if (MONTHS[fields[i]] !== undefined) {
            time = parseBsdtarTime(fields);
            name = fields.slice(i + 3).join(' ').trim();
            break;
          }
        }
        return { name: normalizeArchiveEntry(name), isDirectory: l.endsWith('/'), mtime: time };
      });
  } else {
    const zip = new AdmZip(filePath);
    result = zip.getEntries().map(e => ({
      name: normalizeArchiveEntry(e.entryName),
      isDirectory: e.isDirectory,
      size: e.header.size,
      mtime: e.header.time ? new Date(e.header.time).getTime() : null,
    }));
  }

  setCachedEntries(filePath, result);
  return result;
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
