import React from 'react'
import * as THREE from 'three'

import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { createInfo, DrawingID, getDrawing, ObjectID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { extend, Object3DNode, ThreeEvent } from '@react-three/fiber'

import { Gizmo, getGizmoInfo } from './Gizmo'

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
  const group = React.useRef<THREE.Group>(null!)

  const [gizmoInfo, setGizmoInfo] = React.useState<{ productId: ObjectID; matrix: THREE.Matrix4 } | null>(null)

  const onGeometryMove = React.useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const drawing = getDrawing(drawingId)
      const isSelActive = drawing.selection.active !== null
      const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
      const objClass = drawing.structure.tree[active?.id || -1]?.class || ''
      const isSketchActive = ccUtils.base.isA(objClass, CCClasses.CCSketch)

      if (isSelActive || isSketchActive) {
        return
      }

      e.stopPropagation()

      const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
      const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)
      const hovered = drawing.interaction.hovered
      const hoveredId = isPartMode ? hovered?.graphicId : hovered?.objectId

      if (e.nativeEvent.buttons !== 0) {
        if (hoveredId) {
          const setHovered = drawing.api.interaction.setHovered
          setHovered(null)
        }

        return
      }

      const object = e.intersections.find(i => i.object.userData?.isBuerliGeometry)?.object
      if (!object) {
        return
      }

      const id = isPartMode ? object.userData.containerId : object.userData.productId
      if (id !== hoveredId) {
        const setHovered = drawing.api.interaction.setHovered

        isPartMode &&
          setHovered(
            createInfo({
              objectId: drawing.geometry.cache[id].container.ownerId,
              graphicId: id,
              containerId: id,
              prodRefId: drawing.structure.currentProduct,
            }),
          )
        !isPartMode && setHovered(createInfo({ objectId: id, prodRefId: id }))
      }
    },
    [drawingId],
  )

  const onBackgroundMove = React.useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()

      const drawing = getDrawing(drawingId)
      const isSelActive = drawing.selection.active !== null
      const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
      const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)
      const hovered = drawing.interaction.hovered
      const hoveredId = isPartMode ? hovered?.graphicId : hovered?.objectId

      const object = e.intersections.find(i => i.object.userData?.isBuerliGeometry)?.object

      if (!isSelActive && !object && hoveredId) {
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

      if (isSelActive || isSketchActive) {
        return
      }

      e.stopPropagation()

      const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
      const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

      const intersection = e.intersections.find(i => i.object.userData?.isBuerliGeometry)
      const object = intersection?.object
      if (!object) {
        return
      }

      const id = isPartMode ? object.userData.containerId : object.userData.productId
      if (!isSelActive) {
        if (!isPartMode) {
          const gizmoInfo_ = getGizmoInfo(drawingId, intersection, e.ray)
          setGizmoInfo(gizmoInfo_)
        }

        const select = drawing.api.interaction.select
        const multi = e.nativeEvent.shiftKey

        isPartMode &&
          select(
            createInfo({
              objectId: drawing.geometry.cache[id].container.ownerId,
              graphicId: id,
              containerId: id,
              prodRefId: drawing.structure.currentProduct,
            }),
            multi,
          )
        !isPartMode && select(createInfo({ objectId: id, prodRefId: id }), multi)
      }
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
      <group ref={group} onPointerMove={onGeometryMove} onClick={onGeometryClick}>
        {children}
      </group>
      {gizmoInfo && <Gizmo drawingId={drawingId} productId={gizmoInfo.productId} matrix={gizmoInfo.matrix} />}
      <background onPointerMove={onBackgroundMove} onClick={onBackgroundClick} />
    </>
  )
}
