const path = require('path');

module.exports = {
  entry: './src/game.ts', // Entry point of your application
  mode: 'development', // Or 'production'
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js', // Output bundle file name
    path: path.resolve(__dirname, 'dist'), // Output directory
    publicPath: '/dist/'
  },
  devServer: {
    static: {
        directory: path.join(__dirname, '/'), // Serve files from the root directory
      },
    compress: true,
    port: 9000, // Port for the development server
    devMiddleware: {
        writeToDisk: true, // Write files to disk in dev mode to ensure index.html finds bundle.js
     },
  },
}; 