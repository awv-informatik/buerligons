import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import React from 'react'
import * as THREE from 'three'
import { CursorData, sessionClient, viewpoints } from '@buerli.io/react-cad'

const { useSessionClient } = sessionClient
const { identityColors, useCursors, useFollow } = viewpoints

// Cursor sharing. The pointer is broadcast as a WORLD-SPACE point on the
// sender's view plane (the plane through the orbit target, perpendicular to
// the view direction) — unlike raw screen pixels this survives different
// window sizes and aspect ratios. It is rendered only while following that
// peer, where the synced camera makes the cursor position exactly meaningful.
const CURSOR_INTERVAL_MS = 80

/** Broadcasts this client's pointer on the 'cursor' presence channel. */
export const BroadcastCursor: React.FC = () => {
  const client = useSessionClient()
  const gl = useThree(s => s.gl)
  const camera = useThree(s => s.camera)
  const controls = useThree(s => s.controls as unknown as { target?: THREE.Vector3 } | null)

  React.useEffect(() => {
    if (!client) return
    const el = gl.domElement
    const tmp = new THREE.Vector3()
    const dirTmp = new THREE.Vector3()
    let lastAt = 0
    let trailing: number | undefined
    let latest: CursorData | null = null
    let buttons = 0

    const send = (data: CursorData) => {
      lastAt = performance.now()
      client.sendPresence('cursor', data)
    }
    const project = (e: PointerEvent): [number, number, number] | null => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return null
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      // Unproject the pointer, then slide the point along the view direction
      // onto the plane through the orbit target (ortho: screen x/y invariant).
      tmp.set(nx, ny, 0).unproject(camera)
      const t = controls?.target
      if (t) {
        const camDir = camera.getWorldDirection(dirTmp)
        tmp.addScaledVector(camDir, camDir.dot(t) - camDir.dot(tmp))
      }
      return [tmp.x, tmp.y, tmp.z]
    }
    const onMove = (e: PointerEvent) => {
      const point = project(e)
      if (!point) return
      latest = { point, active: true, buttons }
      const now = performance.now()
      if (now - lastAt >= CURSOR_INTERVAL_MS) {
        send(latest)
      } else {
        window.clearTimeout(trailing)
        trailing = window.setTimeout(() => latest && send(latest), CURSOR_INTERVAL_MS)
      }
    }
    // Presses bypass the throttle: even the shortest click must reach peers
    // (receivers additionally stretch it to a visible minimum duration).
    const onDown = (e: PointerEvent) => {
      buttons = e.buttons
      const point = project(e) ?? latest?.point
      if (!point) return
      latest = { point, active: true, buttons }
      window.clearTimeout(trailing)
      send(latest)
    }
    // On window: a drag may be released outside the canvas.
    const onUp = (e: PointerEvent) => {
      if (buttons === 0) return
      buttons = e.buttons
      if (!latest?.point) return
      latest = { ...latest, buttons }
      window.clearTimeout(trailing)
      send(latest)
    }
    const onLeave = () => {
      window.clearTimeout(trailing)
      latest = null
      send({ active: false })
    }
    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
      window.clearTimeout(trailing)
    }
  }, [client, gl, camera, controls])

  return null
}

/**
 * Renders the followed peer's pointer as a sleek rounded triangle in the
 * peer's color, damped between samples like everything else. Visible only in
 * follow mode and while the peer's pointer is over its canvas.
 */
// A press shorter than this is stretched so quick clicks stay visible.
const CURSOR_PRESS_MIN_MS = 180

export const FollowedCursor: React.FC = () => {
  const follow = useFollow()
  const cursors = useCursors()
  const invalidate = useThree(s => s.invalidate)
  const groupRef = React.useRef<THREE.Group>(null)
  const anim = React.useRef({ pos: new THREE.Vector3(), init: false })

  const data = follow ? cursors[follow.peerId] : undefined
  const goal = React.useMemo(() => (data?.point ? new THREE.Vector3(...data.point) : null), [data])
  // Same pastel pair as the peer's chips and name tag; the dark same-hue
  // outline (instead of white) keeps the arrow readable on any background.
  const colors = identityColors(follow?.name || 'unnamed')
  const visible = Boolean(follow && data?.active && goal)

  // Click animation: shrink while the peer holds a mouse button (left or
  // right). Rising edge shows immediately; the release is delayed until the
  // press was visible for at least CURSOR_PRESS_MIN_MS, so even the shortest
  // click produces a clear pulse. CSS transition — no canvas frames needed.
  const pressed = ((data?.buttons ?? 0) & 3) !== 0
  const [visualPressed, setVisualPressed] = React.useState(false)
  const downAtRef = React.useRef(0)
  React.useEffect(() => {
    if (pressed) {
      downAtRef.current = performance.now()
      setVisualPressed(true)
      return
    }
    const elapsed = performance.now() - downAtRef.current
    const wait = Math.max(0, CURSOR_PRESS_MIN_MS - elapsed)
    const timer = window.setTimeout(() => setVisualPressed(false), wait)
    return () => window.clearTimeout(timer)
  }, [pressed])

  // Re-snap when switching peers; repaint on every new sample (demand mode).
  React.useEffect(() => {
    anim.current.init = false
  }, [follow?.peerId])
  React.useEffect(() => invalidate(), [goal, visible, invalidate])

  useFrame((_, delta) => {
    if (!goal || !groupRef.current) return
    const a = anim.current
    if (!a.init) {
      a.pos.copy(goal)
      a.init = true
    } else {
      // Snappier than the camera damping — cursors should feel immediate.
      const k = 1 - Math.exp(-18 * Math.min(delta, 0.1))
      a.pos.lerp(goal, k)
    }
    groupRef.current.position.copy(a.pos)
    if (a.pos.distanceToSquared(goal) > 1e-12) invalidate()
  })

  if (!visible) return null
  return (
    <group ref={groupRef}>
      <Html style={{ pointerEvents: 'none', userSelect: 'none' }} zIndexRange={[90, 0]}>
        {/* Scale around the triangle tip so the pointed-at spot stays put. */}
        <div
          style={{
            transform: visualPressed ? 'scale(0.68)' : 'scale(1)',
            transformOrigin: '4.5px 3.2px',
            transition: 'transform 90ms ease-out',
          }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            style={{ display: 'block', transform: 'translate(-3px, -2px)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
            <path
              d="M5 3.5 L20.5 10.8 L8.5 16.5 Z"
              fill={colors.bg}
              stroke={colors.text}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </Html>
    </group>
  )
}
