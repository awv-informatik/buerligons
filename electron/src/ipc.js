/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */

const fs = require('fs')
const { ipcMain, dialog } = require('electron')
const { existsSync } = require('fs')
const { CLASSFILE } = require('./config')
const cad = require('./cad')

const CHANNEL = 'ipc-buerligons'

const CHECK_CLASSFILE = 'CHECK_CLASSFILE'
const LOAD_CLASSFILE = 'LOAD_CLASSFILE'

ipcMain.on(CHANNEL, async (event, arg) => {
  const { command } = arg
  switch (command) {
    case CHECK_CLASSFILE:
      event.reply(CHANNEL, JSON.stringify({ command, exists: existsSync(CLASSFILE), file: CLASSFILE }))
      break

    case LOAD_CLASSFILE:
      const dialogRes = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'ClassCAD Application File', extensions: ['ccapp'] }],
      })
      if (!dialogRes.canceled && existsSync(dialogRes.filePaths[0])) {
        fs.copyFileSync(dialogRes.filePaths[0], CLASSFILE)
        await cad.start(CLASSFILE)
        event.reply(CHANNEL, JSON.stringify({ command, exists: existsSync(CLASSFILE) }))
      } else {
        event.reply(CHANNEL, JSON.stringify({ command, exists: false }))
      }
      break

    default:
      break
  }
})
