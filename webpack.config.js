const slsw = require('serverless-webpack')
const nodeExternals = require('webpack-node-externals')

module.exports = {
  entry: slsw.lib.entries,
  stats: 'minimal',
  target: 'node',
  devtool: 'source-map',
  externals: [nodeExternals()],
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
        },
        include: __dirname,
        exclude: /node_modules/,
      },
    ],
  },
}
