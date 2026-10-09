/* eslint-disable @typescript-eslint/ban-ts-comment */
import { DEFAULT_SESSION_URL, SocketIOClient, syncSelection, WASMClient, WSClient } from '@buerli.io/classcad'
import 'antd/dist/antd.less'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useRCadTheme, sessionClient, viewpoints } from '@buerli.io/react-cad'
import { App } from './App'
import { initBuerli } from './initBuerli'
import { engineKey, EnginePlan, PlanClient } from './plan'
import { Global } from './styles/Global'

// @ts-ignore
const classcadWasmKey = CLASSCAD_WASM_KEY
// @ts-ignore
const classcadToken = CLASSCAD_TOKEN
// @ts-ignore
const keyUrl = CLASSCAD_KEY_URL
// @ts-ignore
const socketIoUrl = SOCKETIO_URL
// @ts-ignore
const wsClientUrl = WSCLIENT_URL
// Where a session whose engine runs in a page is joined: a ClassCAD MCP on this machine.
const sessionUrl = SESSION_URL || DEFAULT_SESSION_URL

// Who this page is, for the others in a shared session.
const identity = { app: 'buerligons', kind: 'app' as const }

// What a shared session's participants see of each other besides the model: the cameras, and what is
// selected. One client is in use at a time (a new file is a new drawing, hence a new client).
let stopSharingSelection: (() => void) | undefined
const share = <T extends WASMClient | WSClient>(client: T): T => {
  sessionClient.setSessionClient(client)
  // Attach the presence→store sync BEFORE connecting: viewpoint snapshots
  // arrive right after SessionJoined, typically before any React component
  // mounts. Attaching here avoids losing them.
  viewpoints.syncViewpoints(client)
  stopSharingSelection?.()
  stopSharingSelection = syncSelection(client)
  return client
}

const start = (wasm: EnginePlan | null) =>
  initBuerli(id => {
    const invite = sessionClient.getInviteFromUrl()
    // A ClassCAD server (a worker, or a ClassCAD MCP serving its own engine): sessions are shared by
    // invite. Without an ?invite= token this client is the host of a fresh session; with one it joins
    // the shared session as a guest. A URL without a scheme is on the server this page came from.
    if (wsClientUrl) return share(new WSClient(wsClientUrl, id, { invite, identity }))
    if (wasm) {
      // Opened with an invite: the session is another page's, and a page is joined where the ClassCAD
      // MCP of this machine introduces its guests.
      if (invite) return share(new WSClient(sessionUrl, id, { invite, identity }))
      // The engine runs in this page, which hosts its session itself; the invite panel works as on a server.
      return share(new PlanClient(id, { classcadKey: wasm.key, identity, sessionUrl }, wasm) as WASMClient)
    }
    return new SocketIOClient(socketIoUrl, id)
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

// ClassCAD in the page starts with the key the account's plan allows (plan.ts); a worker or a
// server holds its own.
const wantsWasm = !wsClientUrl && !!(classcadToken || classcadWasmKey)
void (async () => {
  try {
    const wasm = wantsWasm ? await engineKey({ key: classcadWasmKey, token: classcadToken, keyUrl }) : null
    start(wasm)
    root.render(<ThemedApp />)
  } catch (error) {
    root.render(
      <p style={{ font: '15px/1.5 system-ui', padding: 24 }}>
        ClassCAD cannot start in this page: {String((error as Error)?.message ?? error)}
      </p>,
    )
  }
})()
