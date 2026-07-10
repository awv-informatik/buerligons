import { Html } from '@react-three/drei'
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import React from 'react'
import * as THREE from 'three'
import { getInviteFromUrl, useSessionClient } from '../../session/sessionClient'
import { getFollow, setFollow, syncViewpoints, useFollow, useViewpoints, ViewData } from '../../session/viewpoints'

// Shared viewpoints (Fusion-style): every client broadcasts its camera state
// on the 'view' presence channel; siblings render it as a small camera
// frustum with a name label. All values are world-space, so screen size,
// window layout and zoom level of the sender are irrelevant — each receiver
// projects the frustum through its own camera. Clicking a marker enters
// follow mode: your camera tracks that peer's view until you exit via the
// FollowBanner's X (see FollowCamera below).

// Marker distance = NORMALIZED_DIST_FACTOR * sender's visible world height.
// Direction and orientation stay truthful; only the (ortho-irrelevant)
// distance is normalized so markers hover near the model like in Fusion.
// Geometry of the choice: at equal zoom the receiver's screen shows
// visibleHeight world units vertically, so a marker d away from the target
// sits at d / (visibleHeight / 2) half-screen-heights from center — it is
// on-screen only for factors <= 0.5. 0.35 lands it at ~70% toward the edge:
// clearly separated from the model but inside the view.
const NORMALIZED_DIST_FACTOR = 0.35

// Custom drei/Html position calculator: projects the label anchor like the
// default one, but clamps the result to the viewport (with a margin for the
// label body). When a peer's camera marker drifts out of view, its name tag
// pins to the screen border instead of disappearing — pointing toward where
// the peer is.
const tempV3 = new THREE.Vector3()
const clampedCalculatePosition = (
  el: THREE.Object3D,
  camera: THREE.Camera,
  size: { width: number; height: number },
): number[] => {
  tempV3.setFromMatrixPosition(el.matrixWorld)
  tempV3.project(camera)
  const widthHalf = size.width / 2
  const heightHalf = size.height / 2
  const x = tempV3.x * widthHalf + widthHalf
  const y = -(tempV3.y * heightHalf) + heightHalf
  // Margins keep the full label visible: it renders shifted up by ~140% of
  // its height and centered horizontally (see the div transform below).
  const mx = 56
  const myTop = 44
  const myBottom = 16
  return [Math.min(Math.max(x, mx), size.width - mx), Math.min(Math.max(y, myTop), size.height - myBottom)]
}

// Updates are throttled fairly aggressively to keep server traffic low; the
// receiver animates between samples (see ViewpointMarker), so a coarser rate
// still looks perfectly smooth.
const SEND_INTERVAL_MS = 200

// Exponential smoothing rate for remote markers (higher = snappier). At ~10,
// a marker covers most of the way to a new sample in ~200ms — matching the
// send interval, so continuous movement glides instead of stepping.
const DAMPING = 10

/** Stable, readable color per peer, derived from its id. */
const colorFor = (peerId: string): string => {
  let h = 0
  for (let i = 0; i < peerId.length; i++) h = (h * 31 + peerId.charCodeAt(i)) >>> 0
  return `hsl(${h % 360}, 70%, 45%)`
}

/**
 * Normalized goal pose for a peer's view data. Keeps the truthful view
 * direction/target/up but re-derives the position at a distance proportional
 * to the sender's visible world height (see NORMALIZED_DIST_FACTOR).
 */
const goalFromData = (data: ViewData) => {
  const pos = new THREE.Vector3(...(data.position ?? [0, 0, 0]))
  const tgt = new THREE.Vector3(...(data.target ?? [0, 0, 0]))
  const up = new THREE.Vector3(...(data.up ?? [0, 1, 0]))
  const dir = pos.clone().sub(tgt)
  const trueDist = dir.length()
  if (trueDist >= 1e-9) {
    dir.divideScalar(trueDist)
    // Prefer the sender-reported visible height; fall back to the true
    // distance (clamped) for older peers that don't send it.
    const dist = data.height && data.height > 0 ? data.height * NORMALIZED_DIST_FACTOR : Math.min(trueDist, 1000)
    pos.copy(tgt).addScaledVector(dir, dist)
  }
  return { pos, tgt, up }
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
    // While following someone else's camera, our "own view" is just a copy of
    // theirs — don't rebroadcast it (peers keep our last local view instead).
    if (getFollow()) return
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

  // Normalized goal pose (see goalFromData): truthful direction, normalized
  // distance so markers hover near the model regardless of the sender's
  // (ortho-irrelevant) real camera distance.
  const goal = React.useMemo(() => goalFromData(data), [data])

  // Animated pose: samples arrive at SEND_INTERVAL_MS, but the marker glides
  // toward the latest goal every frame (exponential damping), so coarse
  // debounced updates still read as smooth continuous movement.
  const anim = React.useRef({ pos: new THREE.Vector3(), tgt: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), init: false })
  const labelRef = React.useRef<THREE.Group>(null)
  const hitRef = React.useRef<THREE.Mesh>(null)

  const apply = React.useCallback(() => {
    const s = anim.current
    cam.position.copy(s.pos)
    cam.up.copy(s.up)
    cam.lookAt(s.tgt)
    // Frustum length relative to the (normalized) distance to the target, so
    // the marker stays proportionate regardless of model/scene size.
    const dist = cam.position.distanceTo(s.tgt)
    cam.near = Math.max(dist * 0.02, 1e-4)
    cam.far = Math.max(dist * 0.22, 1e-3)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld(true)
    helper.update()
    helper.updateMatrixWorld(true)
    // Size the invisible click target with the frustum.
    hitRef.current?.scale.setScalar(Math.max(dist * 0.18, 1e-3))
  }, [cam, helper])

  const enterFollow = React.useCallback(
    (e?: ThreeEvent<MouseEvent>) => {
      e?.stopPropagation()
      setFollow(peerId, data.name || 'Peer')
    },
    [peerId, data.name],
  )
  const onHitOver = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }, [])
  const onHitOut = React.useCallback(() => {
    document.body.style.cursor = ''
  }, [])
  React.useEffect(
    () => () => {
      document.body.style.cursor = ''
    },
    [],
  )

  // Keeps the label's anchor in FRONT of the viewer's camera. drei/Html hides
  // the element whenever its anchor is behind the camera plane, and our
  // frustum can legitimately end up there (with ortho cameras the viewer's own
  // position along the view axis is arbitrary). The trick: with an
  // orthographic projection, translating a point along the view direction
  // does not change its screen x/y at all — so sliding the anchor forward is
  // pixel-invariant but defeats both the behind-camera hiding and near-plane
  // issues. The label therefore NEVER disappears; combined with the clamped
  // calculatePosition it pins to the screen border instead.
  const camDirTmp = React.useRef(new THREE.Vector3())
  const relTmp = React.useRef(new THREE.Vector3())
  const updateLabelAnchor = React.useCallback(
    (viewerCam: THREE.Camera) => {
      const label = labelRef.current
      if (!label) return
      const s = anim.current
      const camDir = viewerCam.getWorldDirection(camDirTmp.current)
      const depth = relTmp.current.copy(s.pos).sub(viewerCam.position).dot(camDir)
      const minDepth = 1 // keep the anchor a little in front of the camera plane
      label.position.copy(s.pos)
      if (depth < minDepth) {
        label.position.addScaledVector(camDir, minDepth - depth)
      }
      label.updateMatrixWorld(true)
    },
    [],
  )

  // New goal: snap on the very first sample, otherwise just kick a render —
  // the useFrame loop below does the actual easing.
  React.useEffect(() => {
    const s = anim.current
    if (!s.init) {
      s.pos.copy(goal.pos)
      s.tgt.copy(goal.tgt)
      s.up.copy(goal.up)
      s.init = true
      apply()
    }
    invalidate()
  }, [goal, apply, invalidate])

  useFrame((state, delta) => {
    const s = anim.current
    if (!s.init) return
    // Every rendered frame (including the viewer's own camera moves): keep the
    // label anchor in front of the camera so it can never be hidden.
    updateLabelAnchor(state.camera)

    const eps = Math.max(goal.pos.distanceTo(goal.tgt) * 1e-3, 1e-6)
    if (s.pos.distanceTo(goal.pos) < eps && s.tgt.distanceTo(goal.tgt) < eps && s.up.distanceTo(goal.up) < 1e-4) {
      return // converged — let the demand-rendered canvas go idle
    }
    // Framerate-independent exponential smoothing toward the latest sample.
    const k = 1 - Math.exp(-DAMPING * Math.min(delta, 0.1))
    s.pos.lerp(goal.pos, k)
    s.tgt.lerp(goal.tgt, k)
    s.up.lerp(goal.up, k)
    if (s.up.lengthSq() < 1e-8) s.up.copy(goal.up)
    s.up.normalize()
    // Snap when close so the loop terminates crisply.
    if (s.pos.distanceTo(goal.pos) < eps) {
      s.pos.copy(goal.pos)
      s.tgt.copy(goal.tgt)
      s.up.copy(goal.up)
    }
    apply()
    invalidate() // keep animating (frameloop="demand")
  })

  return (
    <>
      <primitive object={helper} />
      <group ref={labelRef}>
        {/* Invisible click target around the frustum apex. userData.onHUD makes
            the raycastFilter prioritize it over model geometry; the anchor
            group's forward-shift is click-equivalent in ortho (moving along
            the view direction doesn't change screen x/y). */}
        <mesh ref={hitRef} userData={{ onHUD: true }} onClick={enterFollow} onPointerOver={onHitOver} onPointerOut={onHitOut}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <Html
          position={[0, 0, 0]}
          calculatePosition={clampedCalculatePosition}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[100, 0]}>
          <div
            onClick={() => enterFollow()}
            title={`View as ${data.name || 'Peer'}`}
            style={{
              transform: 'translate(-50%, -140%)',
              background: color,
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              font: '11px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              whiteSpace: 'nowrap',
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}>
            {data.name || 'Peer'}
          </div>
        </Html>
      </group>
    </>
  )
}

/** Renders the viewpoints of all session siblings, kept in sync via presence. */
export const RemoteViewpoints: React.FC = () => {
  const client = useSessionClient()
  const invalidate = useThree(s => s.invalidate)
  const views = useViewpoints()
  const follow = useFollow()

  // Feed the shared viewpoints store from the client's presence events.
  React.useEffect(() => {
    if (!client) return
    return syncViewpoints(client)
  }, [client])

  // Any store change needs a repaint on a demand-rendered canvas.
  React.useEffect(() => invalidate(), [views, follow, invalidate])

  return (
    <>
      {Object.entries(views)
        // Hide the marker of the peer we're following — we're inside their
        // camera; their frustum would sit right in our face.
        .filter(([peerId]) => peerId !== follow?.peerId)
        .map(([peerId, data]) => (
          <ViewpointMarker key={peerId} peerId={peerId} data={data} />
        ))}
    </>
  )
}

/**
 * Follow mode: while a peer is selected (click on its marker), the local
 * camera glides to and tracks that peer's live viewpoint. The user's own
 * controls are disabled for the duration; the previous local pose is saved on
 * entry and restored when follow mode ends (X in the FollowBanner, or the
 * followed peer leaving). Zoom is matched via the sender's visible world
 * height (myZoom = myViewportPx / theirVisibleHeight), so both screens show
 * the same extent of the model regardless of window sizes.
 */
export const FollowCamera: React.FC = () => {
  const follow = useFollow()
  const views = useViewpoints()
  const camera = useThree(s => s.camera) as THREE.OrthographicCamera
  const size = useThree(s => s.size)
  const controls = useThree(s => s.controls as unknown as ({ target?: THREE.Vector3; enabled?: boolean } | null))
  const invalidate = useThree(s => s.invalidate)
  const saved = React.useRef<{ pos: THREE.Vector3; up: THREE.Vector3; zoom: number; target: THREE.Vector3 } | null>(null)

  // Enter: save the local pose and freeze the controls. Exit: restore both.
  React.useEffect(() => {
    if (follow) {
      if (!saved.current) {
        saved.current = {
          pos: camera.position.clone(),
          up: camera.up.clone(),
          zoom: camera.zoom,
          target: (controls?.target ?? new THREE.Vector3()).clone(),
        }
      }
      if (controls) controls.enabled = false
      invalidate()
      return
    }
    if (saved.current) {
      camera.position.copy(saved.current.pos)
      camera.up.copy(saved.current.up)
      camera.zoom = saved.current.zoom
      controls?.target?.copy(saved.current.target)
      camera.lookAt(saved.current.target)
      camera.updateProjectionMatrix()
      saved.current = null
    }
    if (controls) controls.enabled = true
    invalidate()
  }, [follow, camera, controls, invalidate])

  // New samples for the followed peer must kick a repaint (demand mode).
  React.useEffect(() => {
    if (follow) invalidate()
  }, [views, follow, invalidate])

  useFrame((_, delta) => {
    if (!follow) return
    const data = views[follow.peerId]
    if (!data) return
    const goal = goalFromData(data)
    const goalZoom = data.height && data.height > 0 ? size.height / data.height : camera.zoom
    const eps = Math.max(goal.pos.distanceTo(goal.tgt) * 1e-3, 1e-6)
    const converged =
      camera.position.distanceTo(goal.pos) < eps &&
      (controls?.target?.distanceTo(goal.tgt) ?? 0) < eps &&
      Math.abs(camera.zoom - goalZoom) < Math.max(goalZoom * 1e-3, 1e-6)
    if (converged) return
    // Same framerate-independent damping the markers use.
    const k = 1 - Math.exp(-DAMPING * Math.min(delta, 0.1))
    camera.position.lerp(goal.pos, k)
    camera.up.lerp(goal.up, k)
    if (camera.up.lengthSq() < 1e-8) camera.up.copy(goal.up)
    camera.up.normalize()
    camera.zoom += (goalZoom - camera.zoom) * k
    controls?.target?.lerp(goal.tgt, k)
    camera.lookAt(controls?.target ?? goal.tgt)
    camera.updateProjectionMatrix()
    invalidate() // keep gliding until converged
  })

  return null
}
