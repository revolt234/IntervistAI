const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// 👇 Qui aggiungiamo 'cjs' alle estensioni sorgente
defaultConfig.resolver.sourceExts = [
  ...defaultConfig.resolver.sourceExts,
  'cjs',
];

const config = {};

module.exports = mergeConfig(defaultConfig, config);
