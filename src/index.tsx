/* eslint-disable @typescript-eslint/ban-ts-comment */
import { SocketIOClient, WASMClient } from '@buerli.io/classcad'
import 'antd/dist/antd.less'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initBuerli } from './initBuerli'
import { Global } from './styles/Global'

// @ts-ignore
const classcadWasmKey = CLASSCAD_WASM_KEY
// @ts-ignore
const socketIoUrl = SOCKETIO_URL

initBuerli(id => {
  if (classcadWasmKey) {
    return new WASMClient(id, { classcadKey: classcadWasmKey, logToConsole: true })
  } else {
    return new SocketIOClient(socketIoUrl, id)
  }
})

const container = document.getElementById('root')
const root = createRoot(container!)

root.render(
  <>
    <Global />
    <App />
  </>,
)
