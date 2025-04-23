module.exports = function (context, options) {
    return {
      name: 'fix-esm',
      configureWebpack(config, isServer) {
        return {
          module: {
            rules: [
              {
                test: /\.m?js/,
                resolve: {
                  fullySpecified: false
                }
              }
            ]
          }
        }
      }
    }
  }
  