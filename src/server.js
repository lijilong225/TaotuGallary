const express = require('express');
const session = require('express-session');
const path = require('path');
const { config, ROOT_DIR } = require('./config');
const { ensureDefaultUser } = require('./auth');
const api = require('./routes/api');

ensureDefaultUser();

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));

app.use(session({
  name: 'gal.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use('/api', api);

const publicDir = path.join(ROOT_DIR, 'public');
app.use(express.static(publicDir));

app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Gallery Manager listening on http://0.0.0.0:${config.port}`);
  console.log(`Gallery root: ${config.galleryRoot}`);
});
