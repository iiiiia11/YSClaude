const fs = require('fs');
const path = require('path');

const baseConfig = require('./app.json');

const localFontPaths = [
  './assets/Sohne-Buch.otf',
  './assets/Sohne-Halbfett.otf',
  './assets/SohneMono-Buch.otf',
  './assets/TiemposText.otf',
  './assets/TiemposText-bold.otf',
  './assets/TiemposText-bold2.otf',
  './assets/SourceHanSansSC.otf',
];

function hasFile(relativePath) {
  return fs.existsSync(path.join(__dirname, relativePath));
}

function withOptionalLocalFonts(config) {
  const availableFonts = localFontPaths.filter(hasFile);
  if (availableFonts.length === 0) return config;

  const expo = config.expo ?? {};
  const plugins = [...(expo.plugins ?? [])];

  plugins.push([
    'expo-font',
    {
      fonts: availableFonts,
    },
  ]);

  return {
    ...config,
    expo: {
      ...expo,
      plugins,
    },
  };
}

module.exports = withOptionalLocalFonts(baseConfig);
