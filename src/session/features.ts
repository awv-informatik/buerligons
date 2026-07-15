import { WSClient } from '@buerli.io/classcad'
import { useSyncExternalStore } from 'react'

// Session-wide collaboration features. This is RUNTIME configuration owned by
// the MAIN session (the host): the host toggles features in the share panel
// and broadcasts the config on the reserved 'config' presence channel, which
// the server only accepts from the main connection. Guests receive it via
// that channel (late joiners through the presence snapshot) and apply it —
// nothing travels in URLs, localStorage, or build defines, so there is
// nothing for a guest to edit. Everything defaults to OFF until the host
// enables it.

export type SessionFeatures = {
  /** Peer camera frustums and name tags. */
  viewpoints: boolean
  /**
   * Whether peer cameras can be clicked (via their name tag) to take over the
   * local cam controls and look through that peer's view. Requires viewpoints.
   */
  follow: boolean
  /** Peer pointer while following. Requires follow (and thus viewpoints). */
  cursors: boolean
}

export const DEFAULT_FEATURES: SessionFeatures = { viewpoints: false, follow: false, cursors: false }

let features: SessionFeatures = DEFAULT_FEATURES
const listeners = new Set<() => void>()

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Normalizes a (possibly foreign) config object along the dependency chain
 * viewpoints -> follow -> cursors: following needs visible markers to click,
 * and cursors only render while following.
 */
export const normalizeFeatures = (raw: Partial<SessionFeatures> | null | undefined): SessionFeatures => {
  const viewpoints = Boolean(raw?.viewpoints)
  const follow = Boolean(raw?.follow) && viewpoints
  return { viewpoints, follow, cursors: Boolean(raw?.cursors) && follow }
}

export const getSessionFeatures = (): SessionFeatures => features

export const setSessionFeatures = (next: Partial<SessionFeatures>): SessionFeatures => {
  const normalized = normalizeFeatures({ ...features, ...next })
  if (normalized.viewpoints !== features.viewpoints || normalized.cursors !== features.cursors) {
    features = normalized
    listeners.forEach(l => l())
  }
  return features
}

export const resetSessionFeatures = (): void => {
  setSessionFeatures(DEFAULT_FEATURES)
}

export const useSessionFeatures = (): SessionFeatures =>
  useSyncExternalStore(subscribe, getSessionFeatures, getSessionFeatures)

// ---------------------------------------------------------------------------
// CODE-ENABLE POINT (no UI for now): the session's collaboration features are
// configured here, in code. The host applies this on connect and broadcasts
// it on the owner-only 'config' presence channel; guests receive it (late
// joiners via the presence snapshot) and cannot override it.
// ---------------------------------------------------------------------------
export const SESSION_CONFIG: SessionFeatures = {
  viewpoints: false,
  // Click a peer camera's name tag to take over the local cam controls and
  // look through their view. Off by default.
  follow: false,
  // Peer pointer while following (no effect unless follow is enabled).
  cursors: false,
}

/** Host only: apply SESSION_CONFIG locally and publish it to the session. */
export const publishSessionConfig = (client: WSClient): void => {
  const applied = setSessionFeatures(SESSION_CONFIG)
  client.sendPresence('config', applied)
}
