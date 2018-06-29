'use strict';

module.exports = {
  mode: 'production',
  entry: require.resolve('.'),
  output: {
    path: __dirname,
    filename: 'browser.js',
    library: 'Snekfetch',
    libraryTarget: 'umd',
  },
};
