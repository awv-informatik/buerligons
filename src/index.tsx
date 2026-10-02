/* eslint-disable @typescript-eslint/ban-ts-comment */
import { SocketIOClient, WASMClient, WSClient } from '@buerli.io/classcad'
import 'antd/dist/antd.less'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useRCadTheme, sessionClient, viewpoints } from '@buerli.io/react-cad'
import { App } from './App'
import { initBuerli } from './initBuerli'
import { Global } from './styles/Global'

// @ts-ignore
const classcadWasmKey = CLASSCAD_WASM_KEY
// @ts-ignore
const socketIoUrl = SOCKETIO_URL
// @ts-ignore
const wsClientUrl = WSCLIENT_URL

initBuerli(id => {
  // Drogon multi-client server: enables session sharing + the invite panel.
  // Without an ?invite= token this client is the host of a fresh session;
  // with one it joins the shared session as a guest.
  if (wsClientUrl) {
    const invite = sessionClient.getInviteFromUrl()
    const client = new WSClient(wsClientUrl, id, { invite })
    sessionClient.setSessionClient(client)
    // Attach the presence→store sync BEFORE connecting: viewpoint snapshots
    // arrive right after SessionJoined, typically before any React component
    // mounts. Attaching here avoids losing them.
    viewpoints.syncViewpoints(client)
    return client
  }
  if (classcadWasmKey) {
    // In-page engine: sharing works through MCP bridge tokens (WASMClient.createInvite);
    // register it as the session client so the Session Management panel shows them.
    const client = new WASMClient(id, { classcadKey: classcadWasmKey, app: 'buerligons' })
    sessionClient.setSessionClient(client)
    return client
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
