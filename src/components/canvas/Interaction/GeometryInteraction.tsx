import React from 'react'
import * as THREE from 'three'

import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { createInfo, DrawingID, getDrawing, ObjectID } from '@buerli.io/core'
import { CameraHelper, useDrawing } from '@buerli.io/react'
import { sketchUtils } from '@buerli.io/react-cad'
import { extend, Object3DNode, ThreeEvent, useThree } from '@react-three/fiber'

import { Gizmo, getGizmoInfo } from '../Gizmo'
import { findGeometryIntersection, attemptSSelection, getBuerliGeometry } from './utils'

class Background extends THREE.Object3D {
  override raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    const res = {
      distance: raycaster.far,
      distanceToRay: 0,
      point: raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, raycaster.far),
      index: 0,
      face: null,
      object: this,
    }
    intersects.push(res)
  }
}

extend({ Background })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      background: Object3DNode<Background, typeof Background>
    }
  }
}

export const GeometryInteraction: React.FC<{ drawingId: DrawingID; children?: React.ReactNode }> = ({
  drawingId,
  children,
}) => {
  const [gizmoInfo, setGizmoInfo] = React.useState<{ productId: ObjectID; matrix: THREE.Matrix4 } | null>(null)

  const lnTh = useThree(state => state.raycaster.params.Line?.threshold)
  const ptsTh = useThree(state => state.raycaster.params.Points?.threshold)
  const { camera, size } = useThree()
  const { lineThreshold, pointThreshold } = React.useMemo(() => {
    return {
      lineThreshold: lnTh || CameraHelper.calculateScaleFactor(camera.position, 4, camera, size),
      pointThreshold: ptsTh || CameraHelper.calculateScaleFactor(camera.position, 6, camera, size),
    }
  }, [camera, size, lnTh, ptsTh])

  const onGeometryMove = React.useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const drawing = getDrawing(drawingId)
      const isSelActive = drawing.selection.active !== null

      if (sketchUtils.isSketchActive(drawingId) && !isSelActive) {
        return
      }

      e.stopPropagation()

      const hovered = drawing.interaction.hovered
      if (e.nativeEvent.buttons !== 0) {
        if (hovered) {
          const setHovered = drawing.api.interaction.setHovered
          setHovered(null)
        }

        return
      }

      const intersection = findGeometryIntersection(e.intersections, lineThreshold, pointThreshold)
      const uData = intersection?.object?.userData
      const object = getBuerliGeometry(intersection)
      if (!object || !uData) {
        return
      }

      const interactionInfo = createInfo({
        objectId: object.container.ownerId,
        graphicId: object.graphicId,
        containerId: object.container.id,
        prodRefId: uData.productId,
      })
      if (interactionInfo.uniqueIdent !== drawing.interaction.hovered?.uniqueIdent) {
        const setHovered = drawing.api.interaction.setHovered
        setHovered(interactionInfo)
      }
    },
    [drawingId, lineThreshold, pointThreshold],
  )

  const onBackgroundMove = React.useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const drawing = getDrawing(drawingId)
      const isSelActive = drawing.selection.active !== null

      if (sketchUtils.isSketchActive(drawingId) && !isSelActive) {
        return
      }

      e.stopPropagation()

      const hovered = drawing.interaction.hovered

      const intersection = findGeometryIntersection(e.intersections, lineThreshold, pointThreshold)
      const object = getBuerliGeometry(intersection)

      // Only unhover if BuerliGometry item was hovered
      if (!object && hovered && hovered.graphicId) {
        const setHovered = drawing.api.interaction.setHovered
        setHovered(null)
      }
    },
    [drawingId, lineThreshold, pointThreshold],
  )

  const onGeometryClick = React.useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 4) return

      const drawing = getDrawing(drawingId)
      const isSelActive = drawing.selection.active !== null

      if (sketchUtils.isSketchActive(drawingId) && !isSelActive) {
        return
      }

      e.stopPropagation()

      const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
      const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

      const intersection = findGeometryIntersection(e.intersections, lineThreshold, pointThreshold)
      const uData = intersection?.object?.userData
      const object = getBuerliGeometry(intersection)
      if (!object || !uData) {
        return
      }

      if (isSelActive) {
        attemptSSelection(drawingId, uData.productId, object)
        return
      }

      if (!isPartMode && intersection) {
        const gizmoInfo_ = getGizmoInfo(drawingId, intersection, e.ray)
        setGizmoInfo(gizmoInfo_)
      }

      const interactionInfo = createInfo({
        objectId: object.container.ownerId,
        graphicId: object.graphicId,
        containerId: object.container.id,
        prodRefId: uData.productId,
      })
      const select = drawing.api.interaction.select
      const multi = e.nativeEvent.shiftKey

      select(interactionInfo, multi)
    },
    [drawingId, lineThreshold, pointThreshold],
  )

  const onBackgroundClick = React.useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 4) return

      const drawing = getDrawing(drawingId)
      const isSelActive = drawing.selection.active !== null

      if (sketchUtils.isSketchActive(drawingId) && !isSelActive) {
        return
      }

      e.stopPropagation()
      
      drawing.api.interaction.setSelected([])
      drawing.api.selection?.unselectAll()
    },
    [drawingId],
  )

  const selected = useDrawing(drawingId, d => d.interaction.selected)
  React.useEffect(() => {
    if ((!selected || selected.length === 0) && gizmoInfo) {
      setGizmoInfo(null)
    }
  }, [selected, gizmoInfo])

  return (
    <>
      <group onPointerMove={onGeometryMove} onClick={onGeometryClick}>
        {children}
      </group>
      {gizmoInfo && <Gizmo drawingId={drawingId} productId={gizmoInfo.productId} matrix={gizmoInfo.matrix} />}
      <background onPointerMove={onBackgroundMove} onClick={onBackgroundClick} />
    </>
  )
}
