/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */

const fs = require('fs')
const { Server, ConsoleLogger } = require('@classcad/node')
const { CADPORT, CCBINDIR, CCEXECUTABLE, CCINIFILE, INSTANCECOUNT } = require('./config')

let server

const stop = async () => {
  const s = server
  if (s) {
    server = null
    return s.stop()
  }
}

const start = async classfile => {
  await stop()
  if (fs.existsSync(classfile)) {
    server = new Server(
      {
        publicPort: CADPORT,
        instances: INSTANCECOUNT,
        configurationData: CCINIFILE,
        output: CCBINDIR,
        executable: CCEXECUTABLE,
        enableInvisibleGraphics: true,
        ccappFile: classfile,
      },
      [ConsoleLogger({ characterLimit: Infinity })],
    )
    await server.start()
    return true
  } else {
    return false
  }
}

module.exports = { start, stop }
