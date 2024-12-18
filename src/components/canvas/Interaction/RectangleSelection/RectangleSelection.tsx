import * as THREE from 'three'
import React from 'react'

import { createGraphicItem, createInfo, DrawingID, getDrawing, InteractionInfo, SelectedItem } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { createTreeObjSelItem, sketchUtils, TreeObjScope } from '@buerli.io/react-cad'
import { extend, Object3DNode, useThree, ThreeEvent } from '@react-three/fiber'

import {
  attemptBBObjectsSelection,
  attemptGrObjectsSelection,
  attemptGrPointsSelection,
  attemptRigidsetsSelection,
  attemptSketchesGeomSelection,
  getAllSketchesGeomInfo,
  getInstancesInfo,
  getRigidsetsInfo,
  getSelectableGrObjects,
  getSketchGeomInfo,
  getSolidsInfo,
  GrObjectsInfo,
  InstanceInfo,
  isSelectorValid,
  RigidsetInfo,
  SketchInfo,
  SolidInfo,
} from './utils'
import { Rectangle, RectangleRefType } from './Rectangle'


class RectangleSelectionTrigger extends THREE.Object3D {
  override raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    const res = {
      distance: 0,
      distanceToRay: 0,
      point: raycaster.ray.origin.clone(),
      index: 0,
      face: null,
      object: this,
    }
    intersects.push(res)
  }
}

extend({ RectangleSelectionTrigger })

declare global {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface IntrinsicElements {
      rectangleSelectionTrigger: Object3DNode<RectangleSelectionTrigger, typeof RectangleSelectionTrigger>
    }
  }
}

enum RectSelectionState {
  RECT_INACTIVE = 0,
  RECT_START = 1,
  RECT_ACTIVE = 2,
}

export const RectangleSelection: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const camControls = useThree(s => s.controls as any)

  const [drawRect, setDrawRect] = React.useState<boolean>(false)
  const rectSelectionState = React.useRef<RectSelectionState>(RectSelectionState.RECT_INACTIVE)

  const rectangleRef = React.useRef<RectangleRefType>(null!)

  const solidsInfoRef = React.useRef<SolidInfo[]>([])
  const instancesInfoRef = React.useRef<InstanceInfo[]>([])
  const rigidsetsInfoRef = React.useRef<RigidsetInfo[]>([])
  const sketchesInfoRef = React.useRef<SketchInfo[]>([])
  const selectableGrObjectsRef = React.useRef<GrObjectsInfo>({ bbObjects: [], points: [] })
  const clickPosRef = React.useRef<THREE.Vector3>(new THREE.Vector3())
  const isSelectorValidRef = React.useRef<boolean>(true)

  const onPointerDown = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!e.nativeEvent.shiftKey) {
      return
    }

    const drawing = getDrawing(drawingId)
    const tree = drawing.structure.tree
    const selId = drawing.selection.active
    const isSelActive = selId !== null
    const curProduct = drawing.structure.currentProduct
    const prodClass = tree[curProduct || -1]?.class || ''
    const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

    if (isSelActive) {
      const selector = drawing.selection.refs[selId]
      isSelectorValidRef.current = isSelectorValid(selId)
      if (selector.maxLen > 0 || !isSelectorValidRef.current) {
        // If there is a selection limit for the current selector, don't allow rect-selection at all
        return
      }

      selectableGrObjectsRef.current = getSelectableGrObjects(drawingId, e.camera)
      sketchesInfoRef.current = getAllSketchesGeomInfo(drawingId, e.camera)
      if (isPartMode) {
        solidsInfoRef.current = getSolidsInfo(drawingId, e.camera)
      } else {
        rigidsetsInfoRef.current = getRigidsetsInfo(drawingId, e.camera)
      }
    } else if (sketchUtils.isSketchActive(drawingId)) {
      const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
      const sketchId = active?.objectId
      if (!sketchId) {
        return
      }

      sketchesInfoRef.current = [getSketchGeomInfo(drawingId, sketchId, e.camera)]
    } else if (isPartMode) {
      solidsInfoRef.current = getSolidsInfo(drawingId, e.camera)
    } else {
      instancesInfoRef.current = getInstancesInfo(drawingId, e.camera)
    }

    clickPosRef.current = e.unprojectedPoint.clone().project(e.camera)

    rectangleRef.current.clickPos.set(e.clientX, e.clientY)
    rectangleRef.current.curPos.set(e.clientX, e.clientY)

    rectSelectionState.current = RectSelectionState.RECT_START
    camControls.enabled = false
  }, [drawingId, camControls])

  const onPointerMove = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    const drawing = getDrawing(drawingId)
    
    if (rectSelectionState.current === RectSelectionState.RECT_START) {
      const deltaV = new THREE.Vector2(e.clientX, e.clientY).sub(rectangleRef.current.clickPos)
      const deltaSq = deltaV.lengthSq()

      if (deltaSq > 16) {
        rectSelectionState.current = RectSelectionState.RECT_ACTIVE
        setDrawRect(true)
        
        if (drawing.interaction.hovered) {
          const setHovered = drawing.api.interaction.setHovered
          setHovered(null)
        }
      }
    }

    if (rectSelectionState.current !== RectSelectionState.RECT_ACTIVE) {
      return
    }

    e.stopPropagation()

    rectangleRef.current.curPos.set(e.clientX, e.clientY)
    rectangleRef.current.update()

    const clickPos = clickPosRef.current
    const curPos = e.unprojectedPoint.clone().project(e.camera)

    const onlyEntireBB = curPos.x - clickPos.x > 0

    const minRect = new THREE.Vector2(Math.min(clickPos.x, curPos.x), Math.min(clickPos.y, curPos.y))
    const maxRect = new THREE.Vector2(Math.max(clickPos.x, curPos.x), Math.max(clickPos.y, curPos.y))
    const bbRect = new THREE.Box2(minRect, maxRect)

    const curProduct = drawing.structure.currentProduct
    const tree = drawing.structure.tree
    const selId = drawing.selection.active
    const isSelActive = selId !== null
    const prodClass = tree[curProduct || -1]?.class || ''
    const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

    if (isSelActive) {
      const selector = drawing.selection.refs[selId]
      if (selector.maxLen > 0 || !isSelectorValidRef.current) {
        // If there is a selection limit for the current selector, don't allow rect-selection at all
        return
      }

      const sSelection: SelectedItem[] = []

      if (isPartMode) {
        attemptGrObjectsSelection(
          selectableGrObjectsRef.current.bbObjects,
          bbRect,
          onlyEntireBB,
          (graphicId, containerId) => {
            const grObj = drawing.geometry.cache[containerId].map[graphicId]
            if (grObj) {
              sSelection.push(createGraphicItem(curProduct || -1, grObj))
            }
          }
        )
  
        attemptGrPointsSelection(
          selectableGrObjectsRef.current.points,
          bbRect,
          (graphicId, containerId) => {
            const grPoint = drawing.geometry.cache[containerId].points.find(point => point.graphicId === graphicId)
            if (grPoint) {
              sSelection.push(createGraphicItem(curProduct || -1, grPoint))
            }
          }
        )

        attemptSketchesGeomSelection(
          sketchesInfoRef.current,
          bbRect,
          onlyEntireBB,
          e.camera,
          id => {
            if (selector.isSelectable(TreeObjScope, { object: tree[id] })) {
              sSelection.push(createTreeObjSelItem(curProduct || -1, tree[id]))
            } 
          }
        )

        attemptBBObjectsSelection(
          solidsInfoRef.current,
          bbRect,
          onlyEntireBB,
          id => {
            const solid = drawing.geometry.cache[id]
            if (solid) {
              const elem = { ...solid.meshes[0], type: solid.type, graphicId: solid.graphicId }
              sSelection.push(createGraphicItem(curProduct || -1, elem))
            }
          }
        )
      } else {
        attemptRigidsetsSelection(
          rigidsetsInfoRef.current,
          bbRect,
          onlyEntireBB,
          id => {
            if (selector.isSelectable(TreeObjScope, { object: tree[id] })) {
              sSelection.push(createTreeObjSelItem(curProduct || -1, tree[id]))
            }
          }
        )
      }

      const selApi = drawing.api.selection
      if (sSelection.length !== selector.items.length) {
        if (!selApi.areItemsSelected(sSelection)) {
          selApi.select(sSelection, selId, { forceDefault: true })
        } else {
          const unselItems = selector.items.filter(
            item => !sSelection.find(newItem => newItem.id === item.id && newItem.scope === item.scope)
          )
          selApi.unselect(unselItems, selId, { forceDefault: true })
        }
      }

      return
    }

    const selectionInfo: InteractionInfo[] = []
    const setSelected = drawing.api.interaction.setSelected

    if (sketchUtils.isSketchActive(drawingId)) {
      attemptSketchesGeomSelection(
        sketchesInfoRef.current,
        bbRect,
        onlyEntireBB,
        e.camera,
        id => selectionInfo.push(createInfo({ objectId: id, prodRefId: curProduct }))
      )
    } else if (isPartMode) {
      attemptBBObjectsSelection(
        solidsInfoRef.current,
        bbRect,
        onlyEntireBB,
        id => selectionInfo.push(
          createInfo({
            objectId: drawing.geometry.cache[id]?.container.ownerId || -1,
            graphicId: id,
            containerId: id,
            prodRefId: curProduct,
          })
        )
      )
    } else {
      attemptBBObjectsSelection(
        instancesInfoRef.current,
        bbRect,
        onlyEntireBB,
        id => selectionInfo.push(createInfo({ objectId: id, prodRefId: curProduct }))
      )
    }

    selectionInfo.sort((a, b) => a.uniqueIdent >= b.uniqueIdent ? 1 : -1)
    const curSelected = drawing.interaction.selected // Assume it is already sorted
    if (selectionInfo.length !== curSelected?.length || selectionInfo.some((info, i) => info.uniqueIdent !== curSelected[i].uniqueIdent)) {
      // Only make a new selection if it doesn't match the old one
      setSelected(selectionInfo)
    }
  }, [drawingId])

  const onPointerUp = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    if (rectSelectionState.current === RectSelectionState.RECT_ACTIVE) {
      setDrawRect(false)
    }

    rectSelectionState.current = RectSelectionState.RECT_INACTIVE
    camControls.enabled = true
  }, [camControls])

  return (
    <>
      <rectangleSelectionTrigger onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} userData={{ onHUD: true }} />
      <Rectangle ref={rectangleRef} enabled={drawRect} />
    </>
  )
}
