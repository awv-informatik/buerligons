/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */

const os = require('os')
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const CADPORT = 8182
const INSTANCECOUNT = Math.max(1, os.cpus().length - 3)
const PACKAGEDIR = path.join(__dirname, '..')
const CCBINDIR = path.join(PACKAGEDIR, 'node_modules/@classcad/windows-x64')
const CCEXECUTABLE = 'ClassCADInstance'
const CCINIFILE = path.join(CCBINDIR, 'ClassCAD.ini')

const findCCAppFile = dir => {
  if (typeof dir === 'string') {
    const allFiles = fs.readdirSync(dir)
    for (const file of allFiles) {
      if (path.extname(file) === '.ccapp') {
        // If one is found, use it
        return path.join(dir, file)
      }
    }
  }
  return null
}

// Search for a classfile at several places
let CLASSFILE = findCCAppFile(process.env.PORTABLE_EXECUTABLE_DIR)
if (!CLASSFILE) CLASSFILE = findCCAppFile(process.env.INIT_CWD)
if (!CLASSFILE) CLASSFILE = findCCAppFile(process.cwd())
if (!CLASSFILE) CLASSFILE = findCCAppFile(PACKAGEDIR)
if (!CLASSFILE) CLASSFILE = findCCAppFile(app.getPath('userData'))
if (!CLASSFILE) CLASSFILE = findCCAppFile(app.getPath('home'))
if (!CLASSFILE) CLASSFILE = path.join(app.getPath('userData'), 'Modeling.ccapp')

module.exports = { CADPORT, CCBINDIR, CCEXECUTABLE, CCINIFILE, CLASSFILE, INSTANCECOUNT, PACKAGEDIR }
