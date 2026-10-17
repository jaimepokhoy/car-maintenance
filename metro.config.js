const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite runs on wasm in the browser. Only its *Sync APIs need
// SharedArrayBuffer (and COOP/COEP headers); the app uses async calls only.
config.resolver.assetExts.push('wasm');

module.exports = config;
