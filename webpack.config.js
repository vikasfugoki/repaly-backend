const path = require('path');

module.exports = {
  entry: './src/main.ts',
  target: 'node',
  mode: 'production',
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  externals: ['aws-sdk'],  // Exclude aws-sdk since it's available on Lambda by default
};

