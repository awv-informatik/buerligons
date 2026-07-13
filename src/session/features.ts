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
  /** Peer camera frustums, name tags, and follow mode (click a marker). */
  viewpoints: boolean
  /** Peer pointer while following. Only effective when viewpoints is on. */
  cursors: boolean
}

export const DEFAULT_FEATURES: SessionFeatures = { viewpoints: false, cursors: false }

let features: SessionFeatures = DEFAULT_FEATURES
const listeners = new Set<() => void>()

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Normalizes a (possibly foreign) config object: cursors implies viewpoints. */
export const normalizeFeatures = (raw: Partial<SessionFeatures> | null | undefined): SessionFeatures => {
  const viewpoints = Boolean(raw?.viewpoints)
  return { viewpoints, cursors: Boolean(raw?.cursors) && viewpoints }
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
