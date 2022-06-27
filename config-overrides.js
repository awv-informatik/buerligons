/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')
const fs = require('fs')
const {
  addWebpackAlias,
  removeModuleScopePlugin,
  fixBabelImports,
  addLessLoader,
  override,
  disableEsLint,
  addWebpackModuleRule,
} = require('customize-cra')

// keep the original content of tsconfig.json
const originalTSConfigStr = fs.readFileSync('./tsconfig.json')

module.exports = (config, env) => {
  // Write the original content to tsconfig.json
  fs.writeFileSync('./tsconfig.json', originalTSConfigStr)

  return override(
    addWebpackModuleRule({ test: /\.(of1|stp)$/, use: 'arraybuffer-loader' }),
    disableEsLint(),
    removeModuleScopePlugin(),
    fixBabelImports('import', { libraryName: 'antd', libraryDirectory: 'es', style: true }),
    addLessLoader({ javascriptEnabled: true }),
    addWebpackAlias({
      react: path.resolve(`node_modules/react`),
      antd: path.resolve(`node_modules/antd`),
      'base64-arraybuffer': path.resolve(`node_modules/base64-arraybuffer`),
      'react-dom': path.resolve(`node_modules/react-dom`),
      'styled-components': path.resolve(`node_modules/styled-components`),
      three: path.resolve('node_modules/three'),
      '@react-three/fiber': path.resolve('node_modules/@react-three/fiber'),
      '@react-three/drei': path.resolve('node_modules/@react-three/drei'),
    }),
  )(config, env)
}
