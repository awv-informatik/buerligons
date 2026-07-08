import { SessionRole, WSClient } from '@buerli.io/classcad'
import { useEffect, useState, useSyncExternalStore } from 'react'

// Holds the active WSClient so the session-sharing panel can reach it. Only set
// when buerligons is configured to connect via the Drogon multi-client server
// (WSCLIENT_URL); it stays null for the WASM / SocketIO clients, which have no
// invite model — in that case the panel simply does not render.

let current: WSClient | null = null
const listeners = new Set<() => void>()

export const setSessionClient = (client: WSClient | null): void => {
  current = client
  listeners.forEach(l => l())
}

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** The active WSClient, or null when not connected via the multi-client server. */
export const useSessionClient = (): WSClient | null =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  )

/**
 * This connection's role within the shared session, kept reactive. Guests get
 * their role from the server's `SessionJoined` frame; hosts and the
 * WASM/SocketIO clients (no session client) are always `'edit'`, so this has no
 * effect outside a shared session.
 */
export const useSessionRole = (): SessionRole => {
  const client = useSessionClient()
  const [role, setRole] = useState<SessionRole>(client?.role ?? 'edit')
  useEffect(() => {
    if (!client) {
      setRole('edit')
      return
    }
    setRole(client.role)
    const onJoin = () => setRole(client.role)
    client.on('session_joined', onJoin)
    return () => {
      client.removeListener('session_joined', onJoin)
    }
  }, [client])
  return role
}

/** The invite token this page was opened with, if any (a guest connection). */
export const getInviteFromUrl = (): string | undefined =>
  new URLSearchParams(window.location.search).get('invite') || undefined

/** Build a shareable URL for an invite token, preserving the current origin/path. */
export const buildInviteUrl = (token: string): string =>
  `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`
