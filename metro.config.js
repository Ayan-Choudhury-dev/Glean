const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
// expo-sqlite's web build loads a WASM module; Metro must treat .wasm as an asset.
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './global.css' });
