const path = require('path')

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'vue-image-lazy-loader.bundle.js'
  },
  devtool: 'source-map',
  mode: 'development'
}