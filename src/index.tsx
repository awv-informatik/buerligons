/* eslint-disable @typescript-eslint/ban-ts-comment */
import { SocketIOClient, WASMClient, WSClient } from '@buerli.io/classcad'
import 'antd/dist/antd.less'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initBuerli } from './initBuerli'
import { publishSessionConfig } from './session/features'
import { getInviteFromUrl, setSessionClient } from './session/sessionClient'
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
    const invite = getInviteFromUrl()
    const client = new WSClient(wsClientUrl, id, { invite })
    setSessionClient(client)
    if (!invite) {
      // Host: publish the code-defined session config (see SESSION_CONFIG in
      // session/features.ts) so all guests run the same feature set.
      client.on('connected', () => publishSessionConfig(client))
    }
    return client
  }
  if (classcadWasmKey) {
    return new WASMClient(id, { classcadKey: classcadWasmKey })
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
