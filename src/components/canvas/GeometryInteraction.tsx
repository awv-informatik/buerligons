import React from 'react'
import * as THREE from 'three'

import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { createInfo, DrawingID, GeometryElement, getDrawing, ObjectID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { extend, Object3DNode, ThreeEvent } from '@react-three/fiber'

import { Gizmo, getGizmoInfo } from './Gizmo'
import { selectObject } from './Interaction/utils'

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

  const onGeometryMove = React.useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const drawing = getDrawing(drawingId)
      const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
      const objClass = drawing.structure.tree[active?.id || -1]?.class || ''
      const isSketchActive = ccUtils.base.isA(objClass, CCClasses.CCSketch)

      if (isSketchActive) {
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

      const intersection = e.intersections.find(i => i.object.userData?.isBuerliGeometry)
      const uData = intersection?.object?.userData
      const index = intersection?.index || -1
      const faceIndex = intersection?.faceIndex || -1
      const object: GeometryElement | undefined = uData?.pointMap?.[index] || uData?.lineMap?.[index] || uData?.meshMap?.[faceIndex]
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
    [drawingId],
  )

  const onBackgroundMove = React.useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()

      const drawing = getDrawing(drawingId)
      const hovered = drawing.interaction.hovered

      const intersection = e.intersections.find(i => i.object.userData?.isBuerliGeometry)
      const uData = intersection?.object?.userData
      const index = intersection?.index || -1
      const faceIndex = intersection?.faceIndex || -1
      const object: GeometryElement | undefined = uData?.pointMap?.[index] || uData?.lineMap?.[index] || uData?.meshMap?.[faceIndex]

      if (!object && hovered) {
        const setHovered = drawing.api.interaction.setHovered
        setHovered(null)
      }
    },
    [drawingId],
  )

  const onGeometryClick = React.useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 0) {
        return
      }

      const drawing = getDrawing(drawingId)
      const isSelActive = drawing.selection.active !== null
      const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
      const objClass = drawing.structure.tree[active?.id || -1]?.class || ''
      const isSketchActive = ccUtils.base.isA(objClass, CCClasses.CCSketch)

      if (isSketchActive) {
        return
      }

      e.stopPropagation()
      
      const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
      const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

      const intersection = e.intersections.find(i => i.object.userData?.isBuerliGeometry)
      const uData = intersection?.object?.userData
      const index = intersection?.index || -1
      const faceIndex = intersection?.faceIndex || -1
      const object: GeometryElement | undefined = uData?.pointMap?.[index] || uData?.lineMap?.[index] || uData?.meshMap?.[faceIndex]
      if (!object || !uData) {
        return
      }

      if (isSelActive) {
        selectObject(drawingId, uData.productId, object)
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
    [drawingId],
  )

  const onBackgroundClick = React.useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()

      if (e.delta === 0) {
        const drawing = getDrawing(drawingId)
        drawing?.api.interaction.setSelected([])
        drawing?.api.selection?.unselectAll()
      }
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
