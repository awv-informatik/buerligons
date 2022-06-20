import React from 'react'
import * as THREE from 'three'

import { CCClasses } from '@buerli.io/classcad'
import { DrawingID, getDrawing, ObjectID } from '@buerli.io/core'
import { extend, Object3DNode, useFrame, ThreeEvent } from '@react-three/fiber'

class Background extends THREE.Object3D {
  public raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
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

const findInteractableParent = (drawingId: DrawingID, refId: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const curNodeId = drawing.structure.currentNode || -1
  const curNode = drawing.structure.tree[curNodeId]
  const interactable = curNode?.children || []

  const ancestors: ObjectID[] = []
  let objId: number | null = refId
  while (objId) {
    ancestors.push(objId)
    objId = drawing.structure.tree[objId].parent
  }

  return ancestors.find(id => interactable.indexOf(id) !== -1)
}
  
export const GeometryInteraction: React.FC<{ drawingId: DrawingID }> = ({ drawingId, children }) => {
  const group = React.useRef<THREE.Group>(null!)

  /* useFrame(args => {
    const drawing = getDrawing(drawingId)
    const isSelActive = drawing.selection.active !== null
    const isPartMode = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class === CCClasses.CCPart
    const hovered = drawing.interaction.hovered
    const hoveredId = isPartMode ? hovered?.graphicId : hovered?.objectId

    const intersections = args.raycaster.intersectObjects(group.current.children)
    const object = intersections.find(i => i.object.userData?.isBuerliGeometry)?.object
    if (!object) {
      if (!isSelActive && hoveredId) {
        const setHovered = drawing.api.interaction.setHovered
        setHovered(null)
      }

      return
    }

    const objectId = isPartMode ? object.userData.containerId : findInteractableParent(drawingId, object.userData.productId)
    if (!isSelActive && objectId !== hoveredId) {
      const setHovered = drawing.api.interaction.setHovered
      isPartMode && setHovered({
        objectId: objectId,
        graphicId: objectId,
        containerId: objectId,
        prodRefId: drawing.structure.currentProduct,
        uniqueIdent: objectId.toString()
      })
      !isPartMode && setHovered({ objectId, prodRefId: objectId, uniqueIdent: objectId.toString() })
    }
  }) */
  
  const onGeometryMove = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    const drawing = getDrawing(drawingId)
    const isSelActive = drawing.selection.active !== null
    const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
    const isSketchActive = drawing.structure.tree[active?.id || -1]?.class === CCClasses.CCSketch

    if (isSelActive || isSketchActive) {
      return
    }

    e.stopPropagation()

    const isPartMode = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class === CCClasses.CCPart
    const hovered = drawing.interaction.hovered
    const hoveredId = isPartMode ? hovered?.graphicId : hovered?.objectId

    if (e.buttons !== 0) {
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

    const objectId = isPartMode ? object.userData.containerId : object.userData.productId
    if (objectId !== hoveredId) {
      const setHovered = drawing.api.interaction.setHovered

      isPartMode && setHovered({
        objectId: objectId,
        graphicId: objectId,
        containerId: objectId,
        prodRefId: drawing.structure.currentProduct,
        uniqueIdent: objectId.toString()
      })
      !isPartMode && setHovered({ objectId, prodRefId: objectId, uniqueIdent: objectId.toString() })
    }
  }, [drawingId])

  const onBackgroundMove = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()

    const drawing = getDrawing(drawingId)
    const isSelActive = drawing.selection.active !== null
    const isPartMode = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class === CCClasses.CCPart
    const hovered = drawing.interaction.hovered
    const hoveredId = isPartMode ? hovered?.graphicId : hovered?.objectId

    const object = e.intersections.find(i => i.object.userData?.isBuerliGeometry)?.object

    if (!isSelActive && !object && hoveredId) {
      const setHovered = drawing.api.interaction.setHovered
      setHovered(null)
    }
  }, [drawingId])
    
  const onGeometryClick = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 0) {
      return
    }

    const drawing = getDrawing(drawingId)
    const isSelActive = drawing.selection.active !== null
    const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
    const isSketchActive = drawing.structure.tree[active?.id || -1]?.class === CCClasses.CCSketch

    if (isSelActive || isSketchActive) {
      return
    }

    e.stopPropagation()

    const isPartMode = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class === CCClasses.CCPart

    const object = e.intersections.find(i => i.object.userData?.isBuerliGeometry)?.object
    if (!object) {
      return
    }

    const objectId = isPartMode ? object.userData.containerId : object.userData.productId
    if (!isSelActive) {

      const select = drawing.api.interaction.select
      const multi = e.shiftKey

      isPartMode && select({
        objectId: objectId,
        graphicId: objectId,
        containerId: objectId,
        prodRefId: drawing.structure.currentProduct,
        uniqueIdent: objectId.toString()
      }, multi)
      !isPartMode && select({ objectId, prodRefId: objectId, uniqueIdent: objectId.toString() }, multi)
    }
  }, [drawingId])

  const onBackgroundClick = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    
    if (e.delta === 0) {
      const drawing = getDrawing(drawingId)
      drawing?.api.interaction.setSelected([])
      drawing?.api.selection?.unselectAll()
    }
  }, [drawingId])
  
  return (
    <>
      <group ref={group} onPointerMove={onGeometryMove} onClick={onGeometryClick}>
        {children}
      </group>
      <background onPointerMove={onBackgroundMove} onClick={onBackgroundClick} />
    </>
  )
}
