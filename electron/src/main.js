// To find more info about electron integration, have a look at: https://github.com/richard-dp/electron-react-boilerplate

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */

const { app, globalShortcut, BrowserWindow } = require('electron')
const path = require('path')
const url = require('url')
const { CLASSFILE } = require('./config')

const argv = process.argv.reduce((acc, item) => ({ ...acc, [item]: true }), {})
const development = argv['--development']

require('./ipc')

// Try to start the CAD server immediately. If the classfile does not exist, the application has to ask for it!
const cad = require('./cad')
cad.start(CLASSFILE)

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Buerligons',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (development) {
    globalShortcut.register('f5', () => mainWindow.reload())
    globalShortcut.register('CommandOrControl+R', () => mainWindow.reload())
    mainWindow.openDevTools({ mode: 'detach' })
  }
  mainWindow.loadURL(
    development
      ? 'http://localhost:3000'
      : url.format({
          pathname: path.join(__dirname, '../client/index.html'),
          protocol: 'file:',
          slashes: true,
        }),
  )
  mainWindow.setMenu(null)
  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
app.on('activate', () => mainWindow === null && createWindow())
