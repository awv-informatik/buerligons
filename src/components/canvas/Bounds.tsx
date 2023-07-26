import * as React from 'react'
import * as THREE from 'three'

import { useFrame, useThree } from '@react-three/fiber'

// This is a modified copypaste from drei/Bounds

export type SizeProps = {
  box: THREE.Box3
  size: THREE.Vector3
  center: THREE.Vector3
  distance: number
}

export type BoundsApi = {
  getSize: () => SizeProps
  refresh(object?: THREE.Object3D | THREE.Box3): any
  reset(): any
  moveTo(position: THREE.Vector3): any
  lookAt({ target, up }: { target?: THREE.Vector3; up?: THREE.Vector3 }): any
  fit(): any
  clip(): any
}

export type BoundsProps = JSX.IntrinsicElements['group'] & {
  maxDuration?: number
  margin?: number
}

type ControlsProto = {
  update(): void
  target: THREE.Vector3
  maxDistance: number
  enabled: boolean
  /* addEventListener: (event: string, callback: (event: any) => void) => void
  removeEventListener: (event: string, callback: (event: any) => void) => void */
}

type OriginT = {
  camPos: THREE.Vector3
  camRot: THREE.Quaternion
  camZoom: number
}

type GoalT = {
  camPos: THREE.Vector3 | undefined
  camRot: THREE.Quaternion | undefined
  camZoom: number | undefined
  camUp: THREE.Vector3 | undefined
  target: THREE.Vector3 | undefined
}

enum AnimationState {
  NONE = 0,
  START = 1,
  ACTIVE = 2,
}

const isBox3 = (def: any): def is THREE.Box3 => def && (def as THREE.Box3).isBox3

function interpolate(v0: number, v1: number, t: number) {
  const k = -t * t * t + 2 * t * t
  return v0 * (1 - k) + v1 * k
}

function interpolateV(v: THREE.Vector3, v0: THREE.Vector3, v1: THREE.Vector3, t: number) {
  const k = interpolate(0, 1, t)
  v.lerpVectors(v0, v1, k)
}

function interpolateQ(q: THREE.Quaternion, q0: THREE.Quaternion, q1: THREE.Quaternion, t: number) {
  const k = interpolate(0, 1, t)
  q.slerpQuaternions(q0, q1, k)
}

const context = React.createContext<BoundsApi>(null!)
export function Bounds({ children, maxDuration = 1.0, margin = 1.2 }: BoundsProps) {
  const ref = React.useRef<THREE.Group>(null!)

  const camera = useThree(state => state.camera) as THREE.OrthographicCamera
  const controls = useThree(state => state.controls as unknown as ControlsProto)
  const invalidate = useThree(state => state.invalidate)

  const origin = React.useRef<OriginT>({
    camPos: new THREE.Vector3(),
    camRot: new THREE.Quaternion(),
    camZoom: 1,
  })
  const goal = React.useRef<GoalT>({
    camPos: undefined,
    camRot: undefined,
    camZoom: undefined,
    camUp: undefined,
    target: undefined,
  })
  const animationState = React.useRef<AnimationState>(AnimationState.NONE)
  const t = React.useRef<number>(0) // represent animation state from 0 to 1

  const [box] = React.useState(() => new THREE.Box3())
  const api: BoundsApi = React.useMemo(() => {
    function getSize() {
      const boxSize = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxSize = Math.max(boxSize.x, boxSize.y, boxSize.z)
      const fitDistance = maxSize * 4
      const distance = margin * fitDistance

      return { box, size: boxSize, center, distance }
    }

    return {
      getSize,
      refresh(object?: THREE.Object3D | THREE.Box3) {
        if (isBox3(object)) box.copy(object)
        else {
          const target = object || ref.current
          if (!target) return this
          target.updateWorldMatrix(true, true)
          box.setFromObject(target)
        }
        if (box.isEmpty()) {
          const max = camera.position.length() || 10
          box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(max, max, max))
        }

        origin.current.camPos.copy(camera.position)
        origin.current.camRot.copy(camera.quaternion)
        origin.current.camZoom = camera.zoom

        goal.current.camPos = undefined
        goal.current.camRot = undefined
        goal.current.camZoom = undefined
        goal.current.camUp = undefined
        goal.current.target = undefined

        return this
      },
      reset() {
        const { center, distance } = getSize()

        const direction = camera.position.clone().sub(center).normalize()
        goal.current.camPos = center.clone().addScaledVector(direction, distance)
        goal.current.target = center.clone()
        const mCamRot = new THREE.Matrix4().lookAt(goal.current.camPos, goal.current.target, camera.up)
        goal.current.camRot = new THREE.Quaternion().setFromRotationMatrix(mCamRot)

        controls && (controls.enabled = false)
        animationState.current = AnimationState.START
        t.current = 0

        return this
      },
      moveTo(position: THREE.Vector3) {
        goal.current.camPos = position.clone()

        controls && (controls.enabled = false)
        animationState.current = AnimationState.START
        t.current = 0

        return this
      },
      lookAt({ target, up }: { target: THREE.Vector3; up?: THREE.Vector3 }) {
        goal.current.target = target.clone()
        goal.current.camUp = up ? up.clone() : camera.up.clone()
        const mCamRot = new THREE.Matrix4().lookAt(goal.current.camPos || camera.position, target, goal.current.camUp)
        goal.current.camRot = new THREE.Quaternion().setFromRotationMatrix(mCamRot)

        controls && (controls.enabled = false)
        animationState.current = AnimationState.START
        t.current = 0

        return this
      },
      fit() {
        let maxHeight = 0,
          maxWidth = 0
        const vertices = [
          new THREE.Vector3(box.min.x, box.min.y, box.min.z),
          new THREE.Vector3(box.min.x, box.max.y, box.min.z),
          new THREE.Vector3(box.min.x, box.min.y, box.max.z),
          new THREE.Vector3(box.min.x, box.max.y, box.max.z),
          new THREE.Vector3(box.max.x, box.max.y, box.max.z),
          new THREE.Vector3(box.max.x, box.max.y, box.min.z),
          new THREE.Vector3(box.max.x, box.min.y, box.max.z),
          new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        ]

        // Transform the center and each corner to camera space
        const pos = goal.current.camPos || camera.position
        const target = goal.current.target || controls?.target
        const up = goal.current.camUp || camera.up
        const mCamWInv = target
          ? new THREE.Matrix4().lookAt(pos, target, up).setPosition(pos).invert()
          : camera.matrixWorldInverse
        for (const v of vertices) {
          v.applyMatrix4(mCamWInv)
          maxHeight = Math.max(maxHeight, Math.abs(v.y))
          maxWidth = Math.max(maxWidth, Math.abs(v.x))
        }
        maxHeight *= 2
        maxWidth *= 2
        const zoomForHeight = (camera.top - camera.bottom) / maxHeight
        const zoomForWidth = (camera.right - camera.left) / maxWidth

        goal.current.camZoom = Math.min(zoomForHeight, zoomForWidth) / margin

        controls && (controls.enabled = false)
        animationState.current = AnimationState.START
        t.current = 0

        return this
      },
      clip() {
        const { distance } = getSize()

        camera.near = Math.min(distance / 100, 0.01)
        camera.far = Math.max(distance * 100, 1000)
        camera.updateProjectionMatrix()

        if (controls) {
          controls.maxDistance = distance * 10
          controls.update()
        }

        invalidate()

        return this
      },
    }
  }, [box, camera, controls, margin, invalidate])

  /* React.useLayoutEffect(() => {
    if (controls) {
      // Try to prevent drag hijacking
      const callback = () => (current.animating = false)
      controls.addEventListener('start', callback)
      return () => controls.removeEventListener('start', callback)
    }
  }, [controls]) */

  useFrame((state, delta) => {
    // This (additional animation step START) is needed to guarantee that delta used in animation isn't absurdly high (2-3 seconds) which is actually possible if rendering happens on demand...
    if (animationState.current === AnimationState.START) {
      animationState.current = AnimationState.ACTIVE
      invalidate()
    } else if (animationState.current === AnimationState.ACTIVE) {
      t.current += delta / maxDuration

      if (t.current >= 1) {
        goal.current.camPos && camera.position.copy(goal.current.camPos)
        goal.current.camRot && camera.quaternion.copy(goal.current.camRot)
        goal.current.camUp && camera.up.copy(goal.current.camUp)
        goal.current.camZoom && (camera.zoom = goal.current.camZoom)

        camera.updateMatrixWorld()
        camera.updateProjectionMatrix()

        if (controls && goal.current.target) {
          controls.target.copy(goal.current.target)
          controls.update()
        }

        controls && (controls.enabled = true)
        animationState.current = AnimationState.NONE
      } else {
        goal.current.camPos && interpolateV(camera.position, origin.current.camPos, goal.current.camPos, t.current)
        goal.current.camRot && interpolateQ(camera.quaternion, origin.current.camRot, goal.current.camRot, t.current)
        goal.current.camZoom && (camera.zoom = interpolate(origin.current.camZoom, goal.current.camZoom, t.current))

        camera.updateMatrixWorld()
        camera.updateProjectionMatrix()
      }

      invalidate()
    }
  })

  return (
    <group ref={ref}>
      <context.Provider value={api}>{children}</context.Provider>
    </group>
  )
}

export function useBounds() {
  return React.useContext(context)
}
