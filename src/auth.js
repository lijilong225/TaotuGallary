const { config } = require('./config');

function verify(username, password) {
  return username === config.adminUser && password === config.adminPassword;
}

module.exports = { verify };
