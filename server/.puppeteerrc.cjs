const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer so Render preserves the binaries across deployments.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
