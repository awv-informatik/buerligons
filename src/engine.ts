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
