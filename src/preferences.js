const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./config');

const FILE = path.join(ROOT_DIR, 'data', 'preferences.json');
const VALID_LAYOUTS = ['grid', 'masonry'];
const DEFAULT_PREFS = { layout: 'grid' };

let cache = null;
let writeChain = Promise.resolve();

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
  } catch (e) {
    cache = {};
  }
  return cache;
}

function persist(data) {
  const p = writeChain.then(() => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  });
  writeChain = p.catch(() => {});
  return p;
}

function getPreferences(username) {
  const prefs = load()[username];
  if (!prefs || !VALID_LAYOUTS.includes(prefs.layout)) return { ...DEFAULT_PREFS };
  return { layout: prefs.layout };
}

function setPreference(username, key, value) {
  const data = load();
  if (!data[username]) data[username] = {};
  data[username][key] = value;
  cache = data;
  return persist(data);
}

module.exports = { getPreferences, setPreference, VALID_LAYOUTS };
