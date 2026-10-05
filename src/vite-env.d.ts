/// <reference types="vite/client" />

// How the app reaches ClassCAD, set when it is built (vite.config.ts, from .env and .env.<mode>).
declare const WSCLIENT_URL: string
declare const CLASSCAD_WASM_KEY: string
declare const SOCKETIO_URL: string
declare const SESSION_URL: string
