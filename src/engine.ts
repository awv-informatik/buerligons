import { DrawingID } from '@buerli.io/core'

// Where a drawing's engine runs: in this page, as WebAssembly, or on a server. The two cannot do
// all of the same yet, and the app asks before it offers what one of them lacks.
const inPage = new Set<DrawingID>()

/** Notes where a drawing's engine runs (initBuerli says so when it makes the drawing's client). */
export const setRunsInPage = (drawingId: DrawingID, yes: boolean) => {
  if (yes) inPage.add(drawingId)
  else inPage.delete(drawingId)
}

/** Whether a drawing's engine runs in the page, as WebAssembly. */
export const runsInPage = (drawingId?: DrawingID) => drawingId !== undefined && inPage.has(drawingId)

// How the app reaches a ClassCAD server, set when it is built (vite.config.ts). Declared here as well:
// the modeler compiles these sources too, and builds without it.
declare const WSCLIENT_URL: string | undefined
const serverUrl: string = typeof WSCLIENT_URL === 'string' ? WSCLIENT_URL : ''

/**
 * Whether the page came from what it reaches ClassCAD through (a ClassCAD MCP serves the app next
 * to its session, at an address without a scheme). Such a page exists for one session only: there
 * is no app to go back to without it.
 */
export const servedByEngine = serverUrl.startsWith('/')
