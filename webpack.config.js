/*
  ONLY RUN BUILDS WITH `npm run web-dist`!
  DO NOT USE NORMAL WEBPACK! IT WILL NOT WORK!
*/

const webpack = require('webpack');
const createVariants = require('parallel-webpack').createVariants;
const version = require('./package.json').version;

const createConfig = (options) => {
  const plugins = [
    new webpack.DefinePlugin({ 'global.GENTLY': false })
  ];

  const rules = [
    { test: /\.json$/, loader: 'json-loader' },
    { test: /\.md$/, loader: 'ignore-loader' }
  ]

  if (options.minify) plugins.push(new webpack.optimize.UglifyJsPlugin({ minimize: true }));

  if (options.babelify) rules.push({test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader', query: { presets: ['es2015'] }});

  return {
    entry: './src/index.js',
    output: {
      path: __dirname,
      filename: `./webpack/rpc.${version}${options.babelify ? '' : '.es6'}${options.minify ? '.min' : ''}.js`
    },
    module: { rules },
    node: {
      fs: 'empty',
      tls: 'empty',
      __dirname: true
    },
    plugins
  };
};

module.exports = createVariants({}, {
  minify: [true, false],
  babelify: [true, false]
}, createConfig);
