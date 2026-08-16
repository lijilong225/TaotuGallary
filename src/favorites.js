const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { ROOT_DIR } = require('./config');
const logger = require('./logger');

const DB_FILE = path.join(ROOT_DIR, 'data', 'favorites.db');

let db = null;

function open() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      user    TEXT    NOT NULL,
      path    TEXT    NOT NULL,
      entry   TEXT,
      name    TEXT    NOT NULL,
      mime    TEXT    NOT NULL,
      mtime   INTEGER,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (user, path, entry)
    )
  `);
  return db;
}

function favoriteKey(path, entry) {
  return entry ? `${path}|${entry}` : path;
}

function listFavorites(username) {
  const stmt = open().prepare(
    'SELECT path, entry, name, mime, mtime, added_at FROM favorites WHERE user = ? ORDER BY added_at DESC'
  );
  return stmt.all(username).map(r => ({
    path: r.path,
    entry: r.entry || null,
    name: r.name,
    mime: r.mime,
    mtime: r.mtime || null,
    addedAt: r.added_at,
    type: r.entry ? 'archive' : 'file',
  }));
}

function getFavoriteSet(username) {
  const seen = {};
  const stmt = open().prepare(
    'SELECT path, entry FROM favorites WHERE user = ?'
  );
  for (const r of stmt.all(username)) seen[favoriteKey(r.path, r.entry)] = true;
  return seen;
}

function toggleFavorite(username, { path: mediaPath, entry, name, mime, mtime }) {
  if (!mediaPath || !name || !mime) throw new Error('缺少收藏所需参数');
  const d = open();
  const existing = d.prepare(
    'SELECT 1 FROM favorites WHERE user = ? AND path = ? AND entry IS ?'
  ).get(username, mediaPath, entry || null);

  if (existing) {
    d.prepare('DELETE FROM favorites WHERE user = ? AND path = ? AND entry IS ?')
      .run(username, mediaPath, entry || null);
    logger.info('取消收藏', { user: username, path: mediaPath, entry: entry || null });
    return { favorited: false };
  }

  d.prepare(
    'INSERT OR REPLACE INTO favorites (user, path, entry, name, mime, mtime, added_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(username, mediaPath, entry || null, name, mime, mtime || null, Date.now());
  logger.info('添加收藏', { user: username, path: mediaPath, entry: entry || null });
  return { favorited: true };
}

module.exports = { listFavorites, getFavoriteSet, toggleFavorite };