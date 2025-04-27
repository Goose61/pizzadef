const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

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
    publicPath: '/', 
    clean: true, // Clean the dist folder before each build
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html', // Use index.html as template
      filename: 'index.html' // Output filename in dist folder
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'style.css', to: 'style.css' }, // Copy style.css
        { from: 'assets', to: 'assets' } // Copy assets folder
      ]
    })
  ],
  devServer: {
    static: {
        directory: path.join(__dirname, 'dist'), // Serve files FROM the dist directory
      },
    compress: true,
    port: 9000, // Port for the development server
    watchFiles: ['src/**/*', 'index.html', 'style.css'], 
    hot: true // Ensure HMR is enabled
  },
  watchOptions: {
    ignored: /node_modules|dist/, 
  }
}; 