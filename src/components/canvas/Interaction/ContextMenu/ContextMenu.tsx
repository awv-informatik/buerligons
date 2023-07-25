import React from 'react'
import * as THREE from 'three'
import styled from 'styled-components'
import Dropdown from 'antd/lib/dropdown'

import { createInfo, DrawingID, GeometryElement, getDrawing } from '@buerli.io/core'
import { CameraHelper } from '@buerli.io/react'
import { getCADState } from '@buerli.io/react-cad'
import { extend, Object3DNode, ThreeEvent, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'

import { MenuInfo, MenuDescriptor } from './types'
import { findSuitableIntersection, getGeometryNormal, getObjType, menuElementToItem } from './utils'

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

const MenuWrapper = styled.div`
  border: 1px solid #e0e0e0;
  margin-top: -4px;
  .ant-dropdown-menu-root {
    padding: 2px 0px;
    border: 0px;
    border-radius: 0px;
    .ant-dropdown-menu-item {
      padding: 2px 12px;
    }
    .ant-dropdown-menu-item-divider {
      margin: 2px 0px;
    }
  }
`

const MenuHeader = styled.div`
  padding: 3px 11px;
  background: -webkit-radial-gradient(center, circle, rgba(255,255,255,.35), rgba(255,255,255,0) 20%, rgba(255,255,255,0) 21%), -webkit-radial-gradient(center, circle, rgba(0,0,0,.2), rgba(0,0,0,0) 20%, rgba(0,0,0,0) 21%), #fbfbfb;
  background-size: 10px 10px, 10px 10px, 100% 100%;
  background-position: 1px 1px, 0px 0px, center center;
  box-shadow: 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
`

const MenuHeaderCaption = styled.span`
  font-weight: 700;
  font-size: 14px;
`

export const ContextMenu: React.FC<{ drawingId: DrawingID; menuContent: MenuDescriptor[] }> = ({ drawingId, menuContent }) => {
  const lnTh = useThree(state => state.raycaster.params.Line?.threshold)
  const ptsTh = useThree(state => state.raycaster.params.Points?.threshold)
  const { camera, size } = useThree()
  const { lineThreshold, pointThreshold } = React.useMemo(() => {
    return {
      lineThreshold: lnTh || CameraHelper.calculateScaleFactor(camera.position, 4, camera, size),
      pointThreshold: ptsTh || CameraHelper.calculateScaleFactor(camera.position, 6, camera, size),
    }
  }, [camera, size, lnTh, ptsTh])

  const [menuInfo, setMenuInfo] = React.useState<MenuInfo | null>(null)
  
  React.useEffect(() => {
    if (menuInfo) {
      getCADState().api.blankDiv.show(() => setMenuInfo(null))
    }
    else {
      getCADState().api.blankDiv.hide()
    }
  }, [menuInfo])
  
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

    const intersection = findSuitableIntersection(e.intersections, lineThreshold, pointThreshold)
    const uData = intersection?.object?.userData

    if (!intersection) {
      const clickPos = e.ray.origin.clone().addScaledVector(e.ray.direction, 100)
      setMenuInfo({ clickPos })
    }
    else if (uData?.objId) {
      const object = getDrawing(drawingId).structure.tree[uData.objId]
      if (!object) {
        return
      }
      
      const clickPos = intersection.point.clone()

      const interactionInfo = createInfo({ objectId: object.id })
      setMenuInfo({ clickPos, interactionInfo })
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
      setMenuInfo({ clickPos, clickNormal, interactionInfo })
    }
  }, [drawingId, lineThreshold, pointThreshold])

  const onMenuClick = React.useCallback((e: { key: string }) => {
    if (!menuInfo) {
      return
    }

    const objType = getObjType(drawingId, menuInfo)

    const menuDescriptor = menuContent.find(menuDescriptor_ => menuDescriptor_.objType === objType)
    const menuElement = menuDescriptor?.menuElements.find(menuElement_ => menuElement_.key === e.key)
    const onMenuClick_ = menuElement?.onClick
    
    onMenuClick_ && onMenuClick_(menuInfo)

    setMenuInfo(null)
  }, [drawingId, menuContent, menuInfo])

  const { menuItems, caption, icon } = React.useMemo(() => {
    if (!menuInfo) {
      return { menuItems: [], caption: '', icon: null }
    }

    const objType = getObjType(drawingId, menuInfo)

    const menuDescriptor = menuContent.find(menuDescriptor_ => menuDescriptor_.objType === objType)
    const menuItems_ = menuDescriptor?.menuElements.map(menuElementToItem) || []
    const caption_ = menuDescriptor?.headerName || ''
    const icon_ = menuDescriptor?.headerIcon || null

    return { menuItems: menuItems_, caption: caption_, icon: icon_ }
  }, [drawingId, menuContent, menuInfo])

  return (
    <>
      <contextMenuTrigger onContextMenu={onContextMenu} />
      {menuInfo && (
        <Html position={menuInfo.clickPos}>
          <Dropdown
            menu={{ items: menuItems, onClick: onMenuClick }}
            dropdownRender={(menu) => (
              <MenuWrapper onContextMenu={e => e.preventDefault()}>
                <MenuHeader>
                  {icon}
                  <MenuHeaderCaption>{caption}</MenuHeaderCaption>
                </MenuHeader>
                {menu}
              </MenuWrapper>
            )}
            open>
            <div onContextMenu={e => e.preventDefault() } />
          </Dropdown>
        </Html>
      )}
    </>
  )
}
