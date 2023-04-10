import React from 'react'
import * as THREE from 'three'

import { ObjectID, DrawingID, GeometryBounds, PointMem, ArrayMem, getDrawing, MathUtils } from '@buerli.io/core'
import { useBuerli, useDrawing } from '@buerli.io/react'
import { useEditMode, useIsLoading, useIsSketchActive, useVisibleSolids, EditMode } from '@buerli.io/react-cad'
import { Bounds, SizeProps, useBounds } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * Artifical bounds for when there is no visible geometry on the scene
 */
function DefaultBounds({ drawingId }: { drawingId: DrawingID }) {
  const visibleSolids = useVisibleSolids(drawingId)
  const noSolids = visibleSolids.length === 0

  const bb = React.useMemo(() => {
    const min = new THREE.Vector3(-100, -100, -100)
    const max = new THREE.Vector3(100, 100, 100)
    return new THREE.Box3(min, max)
  }, [])

  return noSolids ? (
    <mesh>
      <bufferGeometry boundingBox={bb} />
    </mesh>
  ) : null
}

const convertToVector = (p: PointMem | undefined) => {
  return p ? new THREE.Vector3(p.value.x, p.value.y, p.value.z) : new THREE.Vector3()
}

const getSketchBounds = (boundsMember: ArrayMem) => {
  const [min, max] = boundsMember.members.map(memb => convertToVector(memb as PointMem))

  const box = new THREE.Box3(min, max)
  const sphere = new THREE.Sphere()
  box.getBoundingSphere(sphere)

  return { center: sphere.center, radius: sphere.radius, box }
}

function interpolate(v0: number, v1: number, t: number) {
  const k = -t * t * t + 2 * t * t
  return v0 * (1 - k) + v1 * k
}

function interpolateV(v: THREE.Vector3 | THREE.Euler, v0: THREE.Vector3 | THREE.Euler, v1: THREE.Vector3 | THREE.Euler, t: number) {
  v.x = interpolate(v0.x, v1.x, t)
  v.y = interpolate(v0.y, v1.y, t)
  v.z = interpolate(v0.z, v1.z, t)
}

function FitSketch({ drawingId }: { drawingId: DrawingID }) {
  const camera = useThree(state => state.camera) as THREE.OrthographicCamera
  const camControls = useThree(state => state.controls as any)
  const invalidate = useThree(state => state.invalidate)
  const boundsControls = useBounds()

  const isSketchActive = useIsSketchActive(drawingId)
  const activeId = useDrawing(drawingId, d => d.plugin.refs[d.plugin.active.feature || -1]?.objectId)
  const planeRef = useDrawing(drawingId, d => d.structure.tree[activeId || -1]?.members?.planeReference?.value as ObjectID)

  const origin = React.useRef({
    camPos: new THREE.Vector3(),
    camRot: new THREE.Euler(),
    camZoom: 1,
  })
  const goal = React.useRef({
    camPos: new THREE.Vector3(),
    camRot: new THREE.Euler(),
    camZoom: 1,
    camUp: new THREE.Vector3(),
    target: new THREE.Vector3(),
  })
  const animating = React.useRef<boolean>(false)
  const t = React.useRef<number>(0) // represent animation state from 0 to 1

  const margin = 1.2
  const maxDuration = 1.0

  // Set camera in front of sketch and adjast zoom to make visible all sketch objects after the sketch is enabled and has planeRef set
  React.useEffect(() => {
    if (!isSketchActive || !activeId || !planeRef) {
      return
    }

    const drawing = getDrawing(drawingId)
    const boundsMember = drawing.structure.tree[activeId]?.members?.boundingBox as ArrayMem

    const bounds = getSketchBounds(boundsMember)
    const plane = drawing.structure.tree[planeRef]
    const normal = convertToVector(plane?.members?.Normal as PointMem)

    const csys = drawing.structure.tree[activeId].coordinateSystem
    const transformMatrix = MathUtils.convertToMatrix3(csys)
    const upVector = new THREE.Vector3(0, 1, 0).applyMatrix3(transformMatrix).normalize()

    // If box.min === box.max add (1000, 1000, 1000) to box.max to make box not empty
    const box = bounds.box
    if (box.min.distanceTo(box.max) < 1e-6) {
      box.set(box.min, box.min.clone().add(new THREE.Vector3(1000, 1000, 1000)))
    }

    // Convert local box coordinates to global
    const matrix4 = MathUtils.convertToMatrix4(csys)
    const globCenter = bounds.center.clone().applyMatrix4(matrix4)
    const globBox = box.clone().applyMatrix4(matrix4)

    goal.current.camPos.copy(globCenter).addScaledVector(normal, bounds.radius * margin * 4)
    goal.current.camUp.copy(upVector)
    goal.current.target.copy(globCenter)

    const mCamRot = new THREE.Matrix4().lookAt(goal.current.camPos, globCenter, upVector)
    const mCamWInv = mCamRot.clone().setPosition(goal.current.camPos).invert()

    goal.current.camRot.setFromRotationMatrix(mCamRot)

    let maxHeight = 0, maxWidth = 0
    const vertices = [
      new THREE.Vector3(globBox.min.x, globBox.min.y, globBox.min.z),
      new THREE.Vector3(globBox.min.x, globBox.max.y, globBox.min.z),
      new THREE.Vector3(globBox.min.x, globBox.min.y, globBox.max.z),
      new THREE.Vector3(globBox.min.x, globBox.max.y, globBox.max.z),
      new THREE.Vector3(globBox.max.x, globBox.max.y, globBox.max.z),
      new THREE.Vector3(globBox.max.x, globBox.max.y, globBox.min.z),
      new THREE.Vector3(globBox.max.x, globBox.min.y, globBox.max.z),
      new THREE.Vector3(globBox.max.x, globBox.min.y, globBox.min.z),
    ]

    // Transform the center and each corner to camera space
    const globCenterC = globCenter.clone().applyMatrix4(mCamWInv)
    for (const v of vertices) {
      v.applyMatrix4(mCamWInv)
      maxHeight = Math.max(maxHeight, Math.abs(v.y - globCenterC.y))
      maxWidth = Math.max(maxWidth, Math.abs(v.x - globCenterC.x))
    }
    maxHeight *= 2
    maxWidth *= 2
    const zoomForHeight = (camera.top - camera.bottom) / maxHeight
    const zoomForWidth = (camera.right - camera.left) / maxWidth

    goal.current.camZoom = Math.min(zoomForHeight, zoomForWidth) / margin
    
    invalidate()

    origin.current.camPos.copy(camera.position)
    origin.current.camRot.copy(camera.rotation)
    origin.current.camZoom = camera.zoom
    camControls.enabled = false
    animating.current = true
    t.current = 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSketchActive, planeRef])

  React.useEffect(() => {
    // Reset camera bounds when sketch is disabled
    if (!isSketchActive) {
      boundsControls?.refresh().fit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSketchActive])
  
  useFrame((state, delta) => {
    if (animating.current) {
      t.current = Math.min(Math.max(t.current + delta / maxDuration, 0), 1)

      interpolateV(camera.position, origin.current.camPos, goal.current.camPos, t.current)
      interpolateV(camera.rotation, origin.current.camRot, goal.current.camRot, t.current)
      camera.zoom = interpolate(origin.current.camZoom, goal.current.camZoom, t.current)

      camera.updateMatrixWorld()
      camera.updateProjectionMatrix()

      invalidate()

      if (t.current >= 1) {
        camera.position.copy(goal.current.camPos)
        camera.rotation.copy(goal.current.camRot)
        camera.up.copy(goal.current.camUp)
        camera.zoom = goal.current.camZoom
        camera.updateMatrixWorld()
        camera.updateProjectionMatrix()

        camControls.target.copy(goal.current.target)
        camControls.update()
        invalidate()

        camControls.enabled = true
        animating.current = false
      }
    }
  })

  return null
}

/**
 * Fit to scene bounds on geometry bounds change when the model is loading.
 */
function FitLoading({ drawingId }: { drawingId: DrawingID }) {
  const bounds = useBounds()

  const isLoading = useIsLoading(drawingId)
  const ccBounds = useDrawing(drawingId, d => d.geometry.bounds) as GeometryBounds

  React.useEffect(() => {
    if (isLoading) {
      bounds?.refresh().clip().fit()
    }
  }, [bounds, ccBounds, isLoading])

  return null
}

/**
 * Fit to scene bounds on part mode enter / leave.
 */
function FitPartProduct({ drawingId }: { drawingId: DrawingID }) {
  const bounds = useBounds()
  const editMode = useEditMode(drawingId)

  React.useEffect(() => {
    if (editMode === EditMode.Part) {
      // Without setTimeout, fit would happen in old bounds
      // TODO: Check how this works with bigger, slower processed modeles!
      window.setTimeout(() => bounds?.refresh().clip().fit(), 100)
      return () => {
        window.setTimeout(() => bounds?.refresh().clip().fit(), 100)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode])

  return null
}

/**
 * Fit to scene bounds after the active drawing changed.
 */
function SwitchDrawing() {
  const bounds = useBounds()
  const currDrId = useBuerli(b => b.drawing.active) || ''

  React.useEffect(() => {
    bounds?.refresh().clip().fit()
  }, [bounds, currDrId])

  return null
}

/**
 * Fit to scene bounds if the user double clicks the Canvas.
 */
function DblClick() {
  const bounds = useBounds()
  const gl = useThree(state => state.gl)

  React.useEffect(() => {
    function onDoubleClick() {
      bounds?.refresh().clip().fit()
    }
    gl.domElement.addEventListener('dblclick', onDoubleClick, { passive: true })
    return () => {
      gl.domElement.removeEventListener('dblclick', onDoubleClick)
    }
  }, [bounds, gl.domElement])

  return null
}

/**
 * Fits three scene to its bounds.
 */
export function Fit({
  drawingId,
  children,
  onFit,
}: {
  drawingId: DrawingID
  children?: React.ReactNode
  onFit?: (bounds: SizeProps) => void
}) {
  return (
    <Bounds onFit={onFit}>
      {children}
      <DefaultBounds drawingId={drawingId} />
      <DblClick />
      <SwitchDrawing />
      <FitSketch drawingId={drawingId} />
      <FitLoading drawingId={drawingId} />
      <FitPartProduct drawingId={drawingId} />
    </Bounds>
  )
}
