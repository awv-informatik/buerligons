import React from 'react'
import * as THREE from 'three'

import { ObjectID, DrawingID, GeometryBounds, PointMem, ArrayMem, getDrawing, MathUtils } from '@buerli.io/core'
import { useBuerli, useDrawing } from '@buerli.io/react'
import { useEditMode, useIsLoading, useIsSketchActive, useVisibleSolids, EditMode } from '@buerli.io/react-cad'
import { useThree } from '@react-three/fiber'

import { Bounds, useBounds } from './Bounds'

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

function FitSketch({ drawingId }: { drawingId: DrawingID }) {
  const boundsControls = useBounds()

  const isSketchActive = useIsSketchActive(drawingId)
  const activeId = useDrawing(drawingId, d => d.plugin.refs[d.plugin.active.feature || -1]?.objectId)
  const planeRef = useDrawing(drawingId, d => d.structure.tree[activeId || -1]?.members?.planeReference?.value as ObjectID)

  const margin = 1.2

  // Set camera in front of sketch and adjast zoom to make visible all sketch objects after the sketch is enabled and has planeRef set
  React.useEffect(() => {
    if (!isSketchActive || !activeId || !planeRef) {
      return
    }

    const drawing = getDrawing(drawingId)
    const boundsMember = drawing.structure.tree[activeId]?.members?.boundingBox as ArrayMem
    const bounds = getSketchBounds(boundsMember)

    const csys = drawing.structure.tree[activeId].coordinateSystem
    const transformMatrix = MathUtils.convertToMatrix3(csys)
    const plane = drawing.structure.tree[planeRef]
    const normal = convertToVector(plane?.members?.Normal as PointMem)
    const up = new THREE.Vector3(0, 1, 0).applyMatrix3(transformMatrix).normalize()

    // If box.min === box.max add (100, 100, 100) to box.max to make box not empty
    const box = bounds.box
    if (box.min.distanceTo(box.max) < 1e-6) {
      box.set(box.min, box.min.clone().add(new THREE.Vector3(100, 100, 100)))
    }

    // Convert local box coordinates to global
    const matrix4 = MathUtils.convertToMatrix4(csys)
    const globBox = box.clone().applyMatrix4(matrix4)
    const target = bounds.center.clone().applyMatrix4(matrix4)
    const position = target.clone().addScaledVector(normal, bounds.radius * margin * 4)

    boundsControls?.refresh(globBox).moveTo(position).lookAt({ target, up }).fit()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSketchActive, planeRef])

  React.useEffect(() => {
    // Reset camera bounds when sketch is disabled
    if (!isSketchActive) {
      window.setTimeout(() => boundsControls?.refresh().fit(), 100)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSketchActive])

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
      bounds?.refresh().reset().fit().clip()
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
      // TODO: Check how this works with bigger, slower processed models!
      window.setTimeout(() => bounds?.refresh().reset().fit().clip(), 100)
      return () => {
        window.setTimeout(() => bounds?.refresh().reset().fit().clip(), 100)
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
    bounds?.refresh().reset().fit().clip()
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
      bounds?.refresh().reset().fit().clip()
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
}: {
  drawingId: DrawingID
  children?: React.ReactNode
}) {
  return (
    <Bounds maxDuration={1}>
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
