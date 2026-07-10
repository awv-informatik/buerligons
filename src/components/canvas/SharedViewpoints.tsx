import { PresenceMessage } from '@buerli.io/classcad'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import React from 'react'
import * as THREE from 'three'
import { getInviteFromUrl, useSessionClient } from '../../session/sessionClient'

// Shared viewpoints (Fusion-style): every client broadcasts its camera state
// on the 'view' presence channel; siblings render it as a small camera
// frustum with a name label. All values are world-space, so screen size,
// window layout and zoom level of the sender are irrelevant — each receiver
// projects the frustum through its own camera.

type ViewData = {
  name?: string
  position?: [number, number, number]
  target?: [number, number, number]
  up?: [number, number, number]
  zoom?: number
  /**
   * Visible world height of the sender's viewport (viewportPx / zoom).
   * With an orthographic camera the on-screen image is invariant to the
   * camera's distance along the view direction, so raw positions can sit at
   * wildly different (visually meaningless) distances between clients. This
   * value is the meaningful "how zoomed out are they" quantity; receivers use
   * it to place the marker at a normalized distance from the target.
   */
  height?: number
}

// Marker distance = NORMALIZED_DIST_FACTOR * sender's visible world height.
// Direction and orientation stay truthful; only the (ortho-irrelevant)
// distance is normalized so markers hover near the model like in Fusion.
const NORMALIZED_DIST_FACTOR = 0.8

const SEND_INTERVAL_MS = 120

/** Stable, readable color per peer, derived from its id. */
const colorFor = (peerId: string): string => {
  let h = 0
  for (let i = 0; i < peerId.length; i++) h = (h * 31 + peerId.charCodeAt(i)) >>> 0
  return `hsl(${h % 360}, 70%, 45%)`
}

const displayName = (): string => {
  try {
    const stored = window.localStorage.getItem('buerligons.username')
    if (stored) return stored
  } catch {
    /* localStorage unavailable — fall through */
  }
  return getInviteFromUrl() ? 'Guest' : 'Host'
}

/**
 * Broadcasts this client's camera viewpoint on the 'view' presence channel.
 * Piggybacks on frameloop="demand": frames only render when something changed,
 * so useFrame is a natural change detector — throttled, with a trailing send so
 * the final resting pose always goes out.
 */
export const BroadcastViewpoint: React.FC = () => {
  const client = useSessionClient()
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  const controls = useThree(s => s.controls as unknown as { target?: THREE.Vector3 } | null)
  const lastSent = React.useRef({ at: 0, hash: '' })
  const trailing = React.useRef<number | undefined>(undefined)

  React.useEffect(() => () => window.clearTimeout(trailing.current), [])

  useFrame(() => {
    if (!client) return
    const t = controls?.target ?? new THREE.Vector3()
    const zoom = (camera as THREE.OrthographicCamera).zoom ?? 1
    const data: ViewData = {
      name: displayName(),
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [t.x, t.y, t.z],
      up: [camera.up.x, camera.up.y, camera.up.z],
      zoom,
      height: size.height / zoom,
    }
    const hash = JSON.stringify([data.position, data.target, data.up, zoom, data.height])
    if (hash === lastSent.current.hash) return
    const now = performance.now()
    const send = () => {
      lastSent.current = { at: performance.now(), hash }
      client.sendPresence('view', data)
    }
    if (now - lastSent.current.at >= SEND_INTERVAL_MS) {
      send()
    } else {
      // Within the throttle window: schedule a trailing send with the latest state.
      window.clearTimeout(trailing.current)
      trailing.current = window.setTimeout(send, SEND_INTERVAL_MS)
    }
  })

  return null
}

/** One remote peer's viewpoint: a stylized camera frustum plus a name tag. */
const ViewpointMarker: React.FC<{ peerId: string; data: ViewData }> = ({ peerId, data }) => {
  const invalidate = useThree(s => s.invalidate)
  const color = React.useMemo(() => colorFor(peerId), [peerId])

  // A small perspective camera gives the classic "pyramid" frustum look —
  // it represents the viewpoint, it doesn't reproduce the ortho projection.
  const { cam, helper } = React.useMemo(() => {
    const cam_ = new THREE.PerspectiveCamera(35, 1.4, 0.01, 1)
    const helper_ = new THREE.CameraHelper(cam_)
    const c = new THREE.Color(color)
    helper_.setColors(c, c, c, c, c)
    return { cam: cam_, helper: helper_ }
  }, [color])

  React.useEffect(
    () => () => {
      helper.dispose()
    },
    [helper],
  )

  // Normalized marker position. With an orthographic camera the sender's true
  // distance to its target is visually meaningless (the image is invariant to
  // translation along the view direction), so raw positions can be arbitrarily
  // near/far between clients. We keep the truthful view DIRECTION but place
  // the marker at a distance proportional to the sender's visible world
  // height — zoomed-in peers hover close to the model, zoomed-out ones
  // farther, and nobody ends up thousands of units away.
  const markerPos = React.useMemo<[number, number, number]>(() => {
    const pos = new THREE.Vector3(...(data.position ?? [0, 0, 0]))
    const tgt = new THREE.Vector3(...(data.target ?? [0, 0, 0]))
    const dir = pos.clone().sub(tgt)
    const trueDist = dir.length()
    if (trueDist < 1e-9) return [pos.x, pos.y, pos.z]
    dir.divideScalar(trueDist)
    // Prefer the sender-reported visible height; fall back to the true
    // distance (clamped) for older peers that don't send it.
    const dist = data.height && data.height > 0 ? data.height * NORMALIZED_DIST_FACTOR : Math.min(trueDist, 1000)
    const p = tgt.add(dir.multiplyScalar(dist))
    return [p.x, p.y, p.z]
  }, [data])

  React.useEffect(() => {
    const tgt = data.target ?? [0, 0, 0]
    const up = data.up ?? [0, 1, 0]
    cam.position.set(markerPos[0], markerPos[1], markerPos[2])
    cam.up.set(up[0], up[1], up[2])
    cam.lookAt(tgt[0], tgt[1], tgt[2])
    // Frustum length relative to the (normalized) distance to the target, so
    // the marker stays proportionate regardless of model/scene size.
    const dist = cam.position.distanceTo(new THREE.Vector3(tgt[0], tgt[1], tgt[2]))
    cam.near = Math.max(dist * 0.02, 1e-4)
    cam.far = Math.max(dist * 0.22, 1e-3)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld(true)
    helper.update()
    helper.updateMatrixWorld(true)
    invalidate()
  }, [cam, helper, data, markerPos, invalidate])

  return (
    <>
      <primitive object={helper} />
      <Html position={markerPos} style={{ pointerEvents: 'none', userSelect: 'none' }} zIndexRange={[100, 0]}>
        <div
          style={{
            transform: 'translate(-50%, -140%)',
            background: color,
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 4,
            font: '11px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            whiteSpace: 'nowrap',
          }}>
          {data.name || 'Peer'}
        </div>
      </Html>
    </>
  )
}

/** Renders the viewpoints of all session siblings, kept in sync via presence. */
export const RemoteViewpoints: React.FC = () => {
  const client = useSessionClient()
  const invalidate = useThree(s => s.invalidate)
  const [views, setViews] = React.useState<Record<string, ViewData>>({})

  React.useEffect(() => {
    if (!client) return
    const onPresence = (_c: unknown, msg: PresenceMessage) => {
      if (msg.channel === 'view' && msg.peerId) {
        setViews(v => ({ ...v, [msg.peerId]: msg.data as ViewData }))
        invalidate()
      } else if (msg.channel === 'leave' && msg.peerId) {
        setViews(v => {
          if (!(msg.peerId in v)) return v
          const next = { ...v }
          delete next[msg.peerId]
          return next
        })
        invalidate()
      }
    }
    client.on('presence', onPresence)
    return () => {
      client.removeListener('presence', onPresence)
    }
  }, [client, invalidate])

  return (
    <>
      {Object.entries(views).map(([peerId, data]) => (
        <ViewpointMarker key={peerId} peerId={peerId} data={data} />
      ))}
    </>
  )
}
