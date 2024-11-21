import React from 'react'
import * as THREE from 'three'

import { ObjectID, DrawingID, getDrawing } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { useEditMode, useIsSketchActive, useVisibleSolids, EditMode, sketchUtils } from '@buerli.io/react-cad'
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
    const bb = new THREE.Box3(ccBounds.min, ccBounds.max)

    bounds?.refresh(bb).moveTo(position).lookAt({ target, up }).fit().clip()
  }, [drawingId, editMode, bounds])

  // Set camera in front of sketch and adjust zoom to make visible all sketch objects after the sketch is enabled and has planeRef set
  React.useEffect(() => {
    if (!isSketchActive || !activeId || !planeRef) {
      return
    }
    
    const sketchFitInfo = sketchUtils.getSketchFitInfo(drawingId, activeId, margin * 4)
    if (!sketchFitInfo) {
      return
    }
  
    const { globBox, position, target, up } = sketchFitInfo
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
