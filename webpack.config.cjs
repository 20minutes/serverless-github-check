const slsw = require('serverless-webpack')

module.exports = {
  entry: slsw.lib.entries,
  stats: 'minimal',
  target: 'node',
  devtool: 'source-map',
  externals: [],
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
}
