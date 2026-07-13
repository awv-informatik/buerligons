import { PresenceMessage, WSClient } from '@buerli.io/classcad'
import { useSyncExternalStore } from 'react'
import { normalizeFeatures, resetSessionFeatures, setSessionFeatures } from './features'

// Shared state for the viewpoint feature: the last known view of every peer
// (fed by 'view' presence frames) and the follow-mode selection ("whose camera
// am I looking through"). Kept in a tiny module store so the canvas components
// (markers, follow camera) and the DOM overlay (banner) stay in sync without
// prop drilling across the Canvas boundary.

export type ViewData = {
  name?: string
  position?: [number, number, number]
  target?: [number, number, number]
  up?: [number, number, number]
  zoom?: number
  /** Visible world height of the sender's viewport (viewportPx / zoom). */
  height?: number
}

export type FollowState = { peerId: string; name: string } | null

/**
 * Stable, readable color per peer connection, derived from its id. Used for
 * the camera frustum, the name tag, the follow-mode cursor, and the swatches
 * in the token panel — one consistent identity color everywhere.
 */
export const colorFor = (peerId: string): string => {
  let h = 0
  for (let i = 0; i < peerId.length; i++) h = (h * 31 + peerId.charCodeAt(i)) >>> 0
  return `hsl(${h % 360}, 70%, 45%)`
}

/**
 * A peer's pointer, broadcast on the 'cursor' presence channel. `point` is
 * world-space, projected onto the sender's view plane (the plane through the
 * orbit target perpendicular to the view direction) — meaningful for any
 * receiver, and exact when the receiver follows the sender's camera.
 */
export type CursorData = {
  point?: [number, number, number]
  active?: boolean
}

let viewpoints: Record<string, ViewData> = {}
let cursors: Record<string, CursorData> = {}
let follow: FollowState = null
// Bounding-sphere radius of the current model (world units), fed from the CAD
// structure (calculateProductBounds). Used to place viewpoint markers on a
// stable ring around the model instead of deriving distance from peers' zoom.
let modelRadius: number | null = null
const listeners = new Set<() => void>()

const notify = () => listeners.forEach(l => l())
const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export const getViewpoints = (): Record<string, ViewData> => viewpoints
export const getCursors = (): Record<string, CursorData> => cursors
export const getFollow = (): FollowState => follow
export const getModelRadius = (): number | null => modelRadius

export const setModelRadius = (radius: number | null): void => {
  if (modelRadius === radius) return
  modelRadius = radius
  notify()
}

export const useModelRadius = (): number | null => useSyncExternalStore(subscribe, getModelRadius, getModelRadius)

export const useViewpoints = (): Record<string, ViewData> =>
  useSyncExternalStore(subscribe, getViewpoints, getViewpoints)

export const useCursors = (): Record<string, CursorData> => useSyncExternalStore(subscribe, getCursors, getCursors)

export const useFollow = (): FollowState => useSyncExternalStore(subscribe, getFollow, getFollow)

export const setFollow = (peerId: string, name: string): void => {
  follow = { peerId, name }
  notify()
}

export const clearFollow = (): void => {
  if (!follow) return
  follow = null
  notify()
}

/**
 * Attaches the store to a WSClient: 'view' presence updates the peer's
 * viewpoint, 'leave' removes it (and exits follow mode if that peer was being
 * followed). Returns a detach function.
 */
export const syncViewpoints = (client: WSClient): (() => void) => {
  const onPresence = (_c: unknown, msg: PresenceMessage) => {
    if (msg.channel === 'view' && msg.peerId) {
      viewpoints = { ...viewpoints, [msg.peerId]: msg.data as ViewData }
      notify()
    } else if (msg.channel === 'cursor' && msg.peerId) {
      cursors = { ...cursors, [msg.peerId]: msg.data as CursorData }
      notify()
    } else if (msg.channel === 'config') {
      // Session feature config from the host. The server only accepts this
      // channel from the main connection, so guests cannot inject it.
      setSessionFeatures(normalizeFeatures(msg.data))
    } else if (msg.channel === 'leave' && msg.peerId) {
      if (msg.peerId in viewpoints) {
        const next = { ...viewpoints }
        delete next[msg.peerId]
        viewpoints = next
      }
      if (msg.peerId in cursors) {
        const next = { ...cursors }
        delete next[msg.peerId]
        cursors = next
      }
      if (follow?.peerId === msg.peerId) follow = null
      notify()
    }
  }
  client.on('presence', onPresence)
  return () => {
    client.removeListener('presence', onPresence)
    viewpoints = {}
    cursors = {}
    follow = null
    resetSessionFeatures()
    notify()
  }
}
