import React from 'react'
import * as THREE from 'three'

import { createInfo, DrawingID, getDrawing, InteractionInfo, ObjectID } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { CameraHelper } from '@buerli.io/react'
import { ContextMenu, getCADState } from '@buerli.io/react-cad'
import { extend, Object3DNode, ThreeEvent, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'

import { CanvasMenuInfo, MenuDescriptor } from './types'
import { getFirstIntersection, getGeometryNormal, getInteractionInfo, getObjType, getSuitableIntersections } from './utils'

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
    const defaultInfo = createInfo({ objectId: currentProduct, prodRefId: currentInstance })

    const rawIntersections = getSuitableIntersections(e.intersections, drawingId)
    const intersections = rawIntersections
      .map(i => getInteractionInfo(drawingId, i))
      .filter(i => i) as InteractionInfo[]
    
    const firstIntersection = getFirstIntersection(rawIntersections, drawingId, lineThreshold, pointThreshold)
    if (!firstIntersection) {
      // If there are no valid intersections, consider the current product being clicked
      const clickPos = e.ray.origin.clone().addScaledVector(e.ray.direction, 100)
      setMenuInfo({ interactionInfo: defaultInfo, clickInfo: { clickPos, intersections } })

      return
    }

    const uData = firstIntersection.object?.userData
    const interactionInfo = getInteractionInfo(drawingId, firstIntersection)
    if (!uData || !interactionInfo) {
      // This should never really happen because of previous code checks, but just in case...
      return
    }

    const objType = getObjType(drawingId, interactionInfo)
    const clickPos = firstIntersection.point.clone()

    if (uData.objId && menuContent.find(menuDescriptor => ccUtils.base.isA(objType, menuDescriptor.objType as CCClasses))) {
      // If there is a suitable menu descriptor for this object type, continue with this object for menuInfo creation
      setMenuInfo({ interactionInfo, clickInfo: { clickPos, intersections } })
      return
    }

    if (uData.isBuerliGeometry && menuContent.find(menuDescriptor => menuDescriptor.objType === objType)) {
      const clickNormal = getGeometryNormal(drawingId, firstIntersection, e.ray)
      // If there is a suitable menu descriptor for this object type, continue with this object for menuInfo creation
      setMenuInfo({ interactionInfo, clickInfo: { clickPos, clickNormal, intersections } })
      return
    }
    
    // If an object couldn't be identified for whatever reason, consider the current product being clicked
    setMenuInfo({ interactionInfo: defaultInfo, clickInfo: { clickPos, intersections } })
  }, [drawingId, lineThreshold, menuContent, pointThreshold])

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
