const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite runs on wasm in the browser. Only its *Sync APIs need
// SharedArrayBuffer (and COOP/COEP headers); the app uses async calls only.
config.resolver.assetExts.push('wasm');

// The app config, with the tenant and its bundled profile, is inlined into
// cached modules. Key the cache on the tenant's files so switching TENANT or
// editing them can't ship another shop's (or a stale) config.
const tenantDir = path.join(__dirname, 'tenants', process.env.TENANT ?? 'default');
const tenantHash = crypto.createHash('sha256');
for (const file of ['tenant.json', 'profile.json']) {
  const filePath = path.join(tenantDir, file);
  tenantHash.update(`${file}:${fs.existsSync(filePath) ? fs.readFileSync(filePath) : ''}\n`);
}
config.cacheVersion = `tenant-${tenantHash.digest('hex').slice(0, 16)}`;

module.exports = config;
