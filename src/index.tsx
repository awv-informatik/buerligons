/* eslint-disable @typescript-eslint/ban-ts-comment */
import { SocketIOClient, WASMClient } from '@buerli.io/classcad'
import 'antd/dist/antd.less'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useRCadTheme } from '@buerli.io/react-cad'
import { App } from './App'
import { initBuerli } from './initBuerli'
import { Global } from './styles/Global'

// @ts-ignore
const classcadWasmKey = CLASSCAD_WASM_KEY
// @ts-ignore
const socketIoUrl = SOCKETIO_URL

initBuerli(id => {
  if (classcadWasmKey) {
    return new WASMClient(id, { classcadKey: classcadWasmKey })
  } else {
    return new SocketIOClient(socketIoUrl, id)
  }
})

// The page takes the app's own colours: the stage's ground, the theme's ink.
const ThemedApp: React.FC = () => {
  const theme = useRCadTheme()
  return (
    <>
      <Global
        background={theme.viewport}
        text={theme.ink}
        scrollbarThumb={theme.scrollbarThumb}
        scrollbarBorder="transparent"
      />
      <App />
    </>
  )
}

const container = document.getElementById('root')
const root = createRoot(container!)

root.render(<ThemedApp />)
