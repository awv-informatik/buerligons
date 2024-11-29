import * as THREE from 'three'
import React from 'react'

import { createInfo, DrawingID, getDrawing, ObjectID } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { sketchUtils } from '@buerli.io/react-cad'
import { extend, Object3DNode, useThree, ThreeEvent } from '@react-three/fiber'

import {
  containsBB,
  containsSketchArc,
  containsSketchCircle,
  containsSketchLine,
  containsSketchPoint,
  getInstancesInfo,
  getPointOnPlane,
  getSketchGeomInfo,
  getSolidsInfo,
  InstanceInfo,
  SketchInfo,
  SolidInfo,
  touchesBB,
  touchesSketchArc,
  touchesSketchCircle,
  touchesSketchLine
} from './utils'
import { Rectangle } from './Rectangle'


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

export const RectangleSelection: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const camControls = useThree(s => s.controls as any)
  const invalidate = useThree(s => s.invalidate)

  const [isActive, setIsActive] = React.useState<boolean>(false)

  const ref = React.useRef<{ clickPos: THREE.Vector2; curPos: THREE.Vector2 }>(null!)

  const solidsInfoRef = React.useRef<SolidInfo[]>([])
  const instancesInfoRef = React.useRef<InstanceInfo[]>([])
  const sketchGeomInfoRef = React.useRef<SketchInfo>({ points: [], lines: [], arcs: [], circles: []})
  const clickPosRef = React.useRef<THREE.Vector3>(new THREE.Vector3())
  const sketchClickPosRef = React.useRef<THREE.Vector3>(new THREE.Vector3())
  const sketchMatrixRef = React.useRef<THREE.Matrix4>(new THREE.Matrix4())
  const sketchMatrixInvRef = React.useRef<THREE.Matrix4>(new THREE.Matrix4())

  const onPointerDown = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!e.nativeEvent.shiftKey) {
      return
    }

    e.stopPropagation()

    camControls.enabled = false

    clickPosRef.current = e.unprojectedPoint.clone().project(e.camera)
    setIsActive(true)

    ref.current.clickPos.set(e.clientX, e.clientY)
    ref.current.curPos.set(e.clientX, e.clientY)

    const drawing = getDrawing(drawingId)
    const tree = drawing.structure.tree
    const curProduct = drawing.structure.currentProduct
    const prodClass = tree[curProduct || -1]?.class || ''
    const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

    if (sketchUtils.isSketchActive(drawingId)) {
      const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
      const sketchId = active?.objectId
      if (!sketchId) {
        return
      }

      sketchGeomInfoRef.current = getSketchGeomInfo(drawingId, sketchId, e.camera)

      const sketchMatrix = drawing.api.structure.calculateGlobalTransformation(sketchId)
      const sketchMatrixInv = sketchMatrix.clone().invert()

      sketchClickPosRef.current = getPointOnPlane(e.unprojectedPoint, e.camera, sketchMatrixInv)
      sketchMatrixRef.current = sketchMatrix
      sketchMatrixInvRef.current = sketchMatrixInv

      return
    }

    if (isPartMode) {
      solidsInfoRef.current = getSolidsInfo(drawingId, e.camera)
      return
    }

    instancesInfoRef.current = getInstancesInfo(drawingId, e.camera)
  }, [drawingId, camControls])

  const onPointerMove = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isActive) {
      return
    }

    e.stopPropagation()
    invalidate()

    ref.current.curPos.set(e.clientX, e.clientY)

    const clickPos = clickPosRef.current
    const curPos = e.unprojectedPoint.clone().project(e.camera)

    const onlyEntireBB = curPos.x - clickPos.x > 0

    const minRect = new THREE.Vector2(Math.min(clickPos.x, curPos.x), Math.min(clickPos.y, curPos.y))
    const maxRect = new THREE.Vector2(Math.max(clickPos.x, curPos.x), Math.max(clickPos.y, curPos.y))
    const bbRect = new THREE.Box2(minRect, maxRect)

    const drawing = getDrawing(drawingId)
    const curProduct = drawing.structure.currentProduct
    const tree = drawing.structure.tree
    const isSelActive = drawing.selection.active !== null
    const prodClass = tree[curProduct || -1]?.class || ''
    const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)
    const setSelected = drawing.api.interaction.setSelected
    
    const selection: ObjectID[] = []

    if (isSelActive) {
      // TODO: Implement RectangleSelection for selectors
      return
    } else if (sketchUtils.isSketchActive(drawingId)) {
      const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
      const sketchId = active.objectId
      if (!sketchId) {
        return
      }

      const sketchMatrixInv = sketchMatrixInvRef.current

      const rectPos1 = new THREE.Vector3(curPos.x, clickPos.y, 0.0)
      const rectPos2 = new THREE.Vector3(clickPos.x, curPos.y, 0.0)

      const sketchPos00 = sketchClickPosRef.current
      const sketchPos11 = getPointOnPlane(e.unprojectedPoint, e.camera, sketchMatrixInv)
      const sketchPos01 = getPointOnPlane(new THREE.Vector3(rectPos1.x, rectPos1.y, 0.0).unproject(e.camera), e.camera, sketchMatrixInv)
      const sketchPos10 = getPointOnPlane(new THREE.Vector3(rectPos2.x, rectPos2.y, 0.0).unproject(e.camera), e.camera, sketchMatrixInv)

      sketchGeomInfoRef.current.points.forEach(pointInfo => {
        if (containsSketchPoint(bbRect, pointInfo)) {
          selection.push(pointInfo.id)
        }
      })

      sketchGeomInfoRef.current.lines.forEach(lineInfo => {
        if (onlyEntireBB && containsSketchLine(bbRect, lineInfo) || !onlyEntireBB && touchesSketchLine(bbRect, lineInfo)) {
          selection.push(lineInfo.id)
        }
      })

      sketchGeomInfoRef.current.arcs.forEach(arcInfo => {
        if (
          onlyEntireBB && containsSketchArc(bbRect, arcInfo, sketchPos00, sketchPos01, sketchPos10, sketchPos11) ||
          !onlyEntireBB && touchesSketchArc(bbRect, arcInfo, sketchPos00, sketchPos01, sketchPos10, sketchPos11)
        ) {
          selection.push(arcInfo.id)
        }
      })

      sketchGeomInfoRef.current.circles.forEach(circleInfo => {
        if (
          onlyEntireBB && containsSketchCircle(bbRect, circleInfo, sketchPos00, sketchPos01, sketchPos10, sketchPos11) ||
          !onlyEntireBB && touchesSketchCircle(bbRect, circleInfo, sketchPos00, sketchPos01, sketchPos10, sketchPos11)
        ) {
          selection.push(circleInfo.id)
        }
      })
    } else if (isPartMode) {
      solidsInfoRef.current.forEach(({ id, bb, aabb }) => {
        if (onlyEntireBB && containsBB(bbRect, bb) || !onlyEntireBB && touchesBB(bbRect, bb, aabb)) {
          selection.push(id)
        }
      })

      selection.sort()
      const curSelectedSolids = drawing.interaction.selected?.map(info => info.containerId || -1).sort()
      if (selection.length !== curSelectedSolids?.length || selection.some((id, i) => id !== curSelectedSolids[i])) {
        const selectionInfo = selection.map(id => createInfo({
          objectId: drawing.geometry.cache[id]?.container.ownerId || -1,
          graphicId: id,
          containerId: id,
          prodRefId: curProduct,
        }))
        setSelected(selectionInfo)
      }

      return
    } else {
      instancesInfoRef.current.forEach(({ id, bb, aabb }) => {
        if (onlyEntireBB && containsBB(bbRect, bb) || !onlyEntireBB && touchesBB(bbRect, bb, aabb)) {
          selection.push(id)
        }
      })
    }

    selection.sort()
    const curSelected = drawing.interaction.selected?.map(info => info.objectId).sort()
    if (selection.length !== curSelected?.length || selection.some((id, i) => id !== curSelected[i])) {
      // Only make a new selection if it doesn't match the old one
      const selectionInfo = selection.map(id => createInfo({ objectId: id, prodRefId: curProduct }))
      setSelected(selectionInfo)
    }
  }, [drawingId, isActive, invalidate])

  const onPointerUp = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isActive) {
      return
    }

    e.stopPropagation()

    camControls.enabled = true

    setIsActive(false)
  }, [isActive, camControls])

  return (
    <>
      <rectangleSelectionTrigger onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
      <Rectangle ref={ref} enabled={isActive} />
    </>
  )
}
