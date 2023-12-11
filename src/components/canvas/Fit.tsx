import React from 'react'
import * as THREE from 'three'

import { ObjectID, DrawingID, PointMem, ArrayMem, getDrawing, MathUtils } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { useEditMode, useIsSketchActive, useVisibleSolids, EditMode } from '@buerli.io/react-cad'
import { Bounds, useBounds } from '@react-three/drei'

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

const defaultCCBounds = { center: new THREE.Vector3(), radius: 200, min: new THREE.Vector3(-100, -100, -100), max: new THREE.Vector3(100, 100, 100) }

const BoundsControls: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const bounds = useBounds()
  const editMode = useEditMode(drawingId)

  const isSketchActive = useIsSketchActive(drawingId)
  const activeId = useDrawing(drawingId, d => d.plugin.refs[d.plugin.active.feature || -1]?.objectId)
  const planeRef = useDrawing(drawingId, d => d.structure.tree[activeId || -1]?.members?.planeReference?.value as ObjectID)

  const margin = 1.2

  // Set camera on top of the model after loading / product type change (Part <---> Assembly)
  React.useEffect(() => {
    const drawing = getDrawing(drawingId)
    const curProd = drawing.structure.currentProduct as ObjectID
    const root = drawing.structure.root

    const structureApi = getDrawing(drawingId).api.structure
    let ccBounds = structureApi.calculateProductBounds(editMode === EditMode.Part ? curProd : root)
    if (ccBounds.radius === -1) {
      ccBounds = defaultCCBounds
    }

    const target = ccBounds.center
    const up = new THREE.Vector3(0, 1, 0)
    const position = new THREE.Vector3(0, 0, ccBounds.radius * margin * 4).add(target)

    bounds?.refresh().moveTo(position).lookAt({ target, up }).fit().clip()
  }, [drawingId, editMode])

  // Set camera in front of sketch and adjust zoom to make visible all sketch objects after the sketch is enabled and has planeRef set
  React.useEffect(() => {
    if (!isSketchActive || !activeId || !planeRef) {
      return
    }

    const drawing = getDrawing(drawingId)
    const boundsMember = drawing.structure.tree[activeId]?.members?.boundingBox as ArrayMem
    const sketchBounds = getSketchBounds(boundsMember)

    const csys = drawing.structure.tree[activeId].coordinateSystem as number[][]
    const transformMatrix = MathUtils.convertToMatrix3(csys)
    const plane = drawing.structure.tree[planeRef]
    const normal = convertToVector(plane?.members?.Normal as PointMem).normalize()
    const up = new THREE.Vector3(0, 1, 0).applyMatrix3(transformMatrix).normalize()

    // If box.min === box.max add (100, 100, 100) to box.max to make box not empty
    const box = sketchBounds.box
    if (box.min.distanceTo(box.max) < 1e-6) {
      box.set(box.min, box.min.clone().add(new THREE.Vector3(100, 100, 100)))
    }

    // Convert local box coordinates to global
    const matrix4 = MathUtils.convertToMatrix4(csys)
    const globBox = box.clone().applyMatrix4(matrix4)
    const target = sketchBounds.center.clone().applyMatrix4(matrix4)
    const position = target.clone().addScaledVector(normal, sketchBounds.radius * margin * 4)

    bounds?.refresh(globBox).moveTo(position).lookAt({ target, up }).fit().clip()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSketchActive, planeRef])

  React.useEffect(() => {
    // Reset camera bounds when sketch is disabled
    if (!isSketchActive) {
      bounds?.refresh().fit().clip()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSketchActive])

  return null
}

const interpolateFunc = (t: number) => {
  return -t * t * t + 2 * t * t
}

/**
 * Fits three scene to its bounds.
 */
export const Fit: React.FC<{ drawingId: DrawingID; children?: React.ReactNode }> = ({
  drawingId,
  children,
}) => {
  return (
    <Bounds maxDuration={1} interpolateFunc={interpolateFunc}>
      {children}
      <DefaultBounds drawingId={drawingId} />
      <BoundsControls drawingId={drawingId} />
    </Bounds>
  )
}
