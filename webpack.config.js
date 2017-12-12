const path = require('path');
const webpack = require('webpack');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

const plugins = [
  new webpack.optimize.ModuleConcatenationPlugin(),
];

const prod = process.env.NODE_ENV === 'production';

if (prod) {
  plugins.push(new UglifyJSPlugin({
    uglifyOptions: {
      mangle: { keep_classnames: true },
      output: { comments: false },
    },
  }));
}

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve('./webpack'),
    filename: `discord-rpc${prod ? '.min' : ''}.js`,
    library: 'DiscordRPC',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      { test: /\.md$/, loader: 'ignore-loader' },
      {
        test: require.resolve('./package.json'),
        use: {
          loader: 'json-filter-loader',
          options: {
            used: ['version', 'homepage'],
          },
        },
      },
    ],
  },
  node: {
    fs: 'empty',
    dns: 'empty',
    tls: 'empty',
    child_process: 'empty',
    dgram: 'empty',
    __dirname: true,
    process: false,
    path: 'empty',
    Buffer: false,
    zlib: 'empty',
  },
  plugins,
};
