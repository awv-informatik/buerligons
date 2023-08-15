import React from 'react'
import * as THREE from 'three'

import { createInfo, DrawingID, GeometryElement, getDrawing, ObjectID } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { CameraHelper } from '@buerli.io/react'
import { ContextMenu, getCADState } from '@buerli.io/react-cad'
import { extend, Object3DNode, ThreeEvent, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'

import { CanvasMenuInfo, MenuDescriptor } from './types'
import { findSuitableIntersection, getGeometryNormal, getObjType } from './utils'

class ContextMenuTrigger extends THREE.Object3D {
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

extend({ ContextMenuTrigger })

declare global {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface IntrinsicElements {
      contextMenuTrigger: Object3DNode<ContextMenuTrigger, typeof ContextMenuTrigger>
    }
  }
}

export const CanvasContextMenu: React.FC<{ drawingId: DrawingID; menuContent: MenuDescriptor[] }> = ({ drawingId, menuContent }) => {
  const lnTh = useThree(state => state.raycaster.params.Line?.threshold)
  const ptsTh = useThree(state => state.raycaster.params.Points?.threshold)
  const { camera, size } = useThree()
  const { lineThreshold, pointThreshold } = React.useMemo(() => {
    return {
      lineThreshold: lnTh || CameraHelper.calculateScaleFactor(camera.position, 4, camera, size),
      pointThreshold: ptsTh || CameraHelper.calculateScaleFactor(camera.position, 6, camera, size),
    }
  }, [camera, size, lnTh, ptsTh])

  const onHide = React.useCallback(() => {
    const setHovered = getDrawing(drawingId).api.interaction.setHovered
    setHovered(null)
    setMenuInfo(null)
  }, [drawingId])

  const [menuInfo, setMenuInfo] = React.useState<CanvasMenuInfo | null>(null)
  
  React.useEffect(() => {
    if (menuInfo) {
      getCADState().api.blankDiv.show(onHide)
    }
    else {
      getCADState().api.blankDiv.hide()
    }
  }, [menuInfo, onHide])
  
  React.useEffect(() => {
    const cm = (e: MouseEvent) => {
      if (menuInfo && (e.target as HTMLDivElement).className === 'ant-dropdown ant-dropdown-placement-bottomLeft ') {
        e.preventDefault()
      }
    }

    window.addEventListener("contextmenu", cm)
    return () => window.removeEventListener('contextmenu', cm)
  }, [menuInfo])

  const onContextMenu = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) {
      return
    }

    e.stopPropagation()

    const drawing = getDrawing(drawingId)
    const currentProduct = drawing.structure.currentProduct as ObjectID
    const currentInstance = drawing.structure.currentInstance
    const defaultIInfo = createInfo({ objectId: currentProduct, prodRefId: currentInstance })

    const intersection = findSuitableIntersection(e.intersections, lineThreshold, pointThreshold)
    const uData = intersection?.object?.userData

    if (!intersection) {
      // If there are no valid intersections, consider the current product being clicked
      const clickPos = e.ray.origin.clone().addScaledVector(e.ray.direction, 100)
      setMenuInfo({ interactionInfo: defaultIInfo, clickInfo: { clickPos } })
    }
    else if (uData?.objId) {
      const object = getDrawing(drawingId).structure.tree[uData.objId]
      if (!object) {
        return
      }
      
      const clickPos = intersection.point.clone()

      const interactionInfo = createInfo({ objectId: object.id })
      const objType = getObjType(drawingId, interactionInfo)
      if (menuContent.find(menuDescriptor => ccUtils.base.isA(objType, menuDescriptor.objType as CCClasses))) {
        // If there is a suitable menu descriptor for this object type, continue with this object for menuInfo creation
        setMenuInfo({ interactionInfo, clickInfo: { clickPos } })
      }
      else {
        // Otherwise - consider the current product being clicked
        setMenuInfo({ interactionInfo: defaultIInfo, clickInfo: { clickPos } })
      }
    }
    else if (uData?.isBuerliGeometry) {
      const index = intersection?.index ?? -1
      const faceIndex = intersection?.faceIndex ?? -1
      const object: GeometryElement | undefined = uData?.pointMap?.[index] || uData?.lineMap?.[index] || uData?.meshMap?.[faceIndex]
      if (!object) {
        return
      }

      const clickPos = intersection.point.clone()
      const clickNormal = getGeometryNormal(drawingId, intersection, e.ray)

      const interactionInfo = createInfo({
        objectId: object.container.ownerId,
        graphicId: object.graphicId,
        containerId: object.container.id,
        prodRefId: uData.productId,
      })
      const objType = getObjType(drawingId, interactionInfo)
      if (menuContent.find(menuDescriptor => menuDescriptor.objType === objType)) {
        // If there is a suitable menu descriptor for this object type, continue with this object for menuInfo creation
        setMenuInfo({ interactionInfo, clickInfo: { clickPos, clickNormal } })
      }
      else {
        // Otherwise - consider the current product being clicked
        setMenuInfo({ interactionInfo: defaultIInfo, clickInfo: { clickPos } })
      }

    }
  }, [drawingId, lineThreshold, pointThreshold])

  const { menuItems, caption, icon } = React.useMemo(() => {
    if (!menuInfo) {
      return { menuItems: undefined, caption: '', icon: undefined }
    }

    const objType = getObjType(drawingId, menuInfo.interactionInfo)

    const menuDescriptor = menuContent.find(menuDescriptor_ => menuDescriptor_.objType === objType || ccUtils.base.isA(objType, menuDescriptor_.objType as CCClasses))
    const menuItems_ = menuDescriptor?.menuElements
    const caption_ = menuDescriptor?.headerName || ''
    const icon_ = menuDescriptor?.headerIcon

    return { menuItems: menuItems_, caption: caption_, icon: icon_ }
  }, [drawingId, menuContent, menuInfo])

  return (
    <>
      <contextMenuTrigger onContextMenu={onContextMenu} />
      {menuInfo && menuItems && (
        <Html position={menuInfo.clickInfo.clickPos}>
          <ContextMenu items={menuItems} menuInfo={menuInfo} caption={caption} icon={icon} onHide={onHide} open>
            <div onContextMenu={e => e.preventDefault() } />
          </ContextMenu>
        </Html>
      )}
    </>
  )
}
