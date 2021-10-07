/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')
const fs = require('fs')
const verifyTypeScriptSetup = require('react-scripts/scripts/utils/verifyTypeScriptSetup')
const {
  addWebpackAlias,
  removeModuleScopePlugin,
  addWebpackPlugin,
  fixBabelImports,
  addLessLoader,
  override,
  disableEsLint,
  addWebpackModuleRule,
} = require('customize-cra')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

// keep the original content of tsconfig.json
const originalTSConfigStr = fs.readFileSync('./tsconfig.json')
require.cache[require.resolve('react-scripts/scripts/utils/verifyTypeScriptSetup')].exports = function () {
  verifyTypeScriptSetup()
  // write the original content to tsconfig.json
  fs.writeFileSync('tsconfig.json', originalTSConfigStr)
}

module.exports = (config, env) =>
  override(
    addWebpackModuleRule({ test: /\.(of1|stp)$/, use: 'arraybuffer-loader' }),
    disableEsLint(),
    removeModuleScopePlugin(),
    fixBabelImports('import', { libraryName: 'antd', libraryDirectory: 'es', style: true }),
    addLessLoader({ javascriptEnabled: true }),
    process.env.NODE_ENV === 'production' && addWebpackPlugin(new BundleAnalyzerPlugin()),
    addWebpackAlias({
      react: path.resolve(`node_modules/react`),
      antd: path.resolve(`node_modules/antd`),
      'base64-arraybuffer': path.resolve(`node_modules/base64-arraybuffer`),
      'react-dom': path.resolve(`node_modules/react-dom`),
      'styled-components': path.resolve(`node_modules/styled-components`),
      three: path.resolve('node_modules/three'),
      '@react-three/fiber': path.resolve('node_modules/@react-three/fiber'),
    }),
  )(config, env)
