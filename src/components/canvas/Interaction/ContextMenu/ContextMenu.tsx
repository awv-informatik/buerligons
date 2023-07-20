/* eslint-disable max-lines */
import React from 'react'
import * as THREE from 'three'
import styled from 'styled-components'
import DropdownImpl from 'antd/lib/dropdown'
import { MenuProps } from 'antd/lib/menu'

import { CCClasses, ccAPI, ccUtils } from '@buerli.io/classcad'
import { ArrayMem, createInfo, DrawingID, GeometryElement, getDrawing, InteractionInfo, MathUtils, ObjectID, PointMem } from '@buerli.io/core'
import { CameraHelper } from '@buerli.io/react'
import { getCADState } from '@buerli.io/react-cad'
import { extend, Object3DNode, ThreeEvent, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { ZoomInOutlined, VerticalAlignTopOutlined, BorderOuterOutlined, DeleteOutlined } from '@ant-design/icons'

import partURL from '@buerli.io/icons/SVG/part.svg'
import assemblyURL from '@buerli.io/icons/SVG/assembly.svg'
import isometricURL from '@buerli.io/icons/SVG/isometric.svg'
import sketchURL from '@buerli.io/icons/SVG/sketch.svg'
import workplaneURL from '@buerli.io/icons/SVG/workplane.svg'

import { useBounds } from '../../Bounds'
import { getAdjacentMeshNormal } from '../../Gizmo/utils'

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

const Dropdown = styled(DropdownImpl)`
`

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

const MenuHeaderIcon: React.FC<{ url: string }> = ({ url }) => {
  return (
    <span style={{ marginTop: '1px', marginRight: '7px', verticalAlign: '-1px' }}>
      <svg width="14" height="14">
        <image href={url} width="14" height="14" />
      </svg>
    </span>
  )
}

type MenuInfo = { clickPos: THREE.Vector3; clickNormal?: THREE.Vector3; interactionInfo?: InteractionInfo }

const suitableCCClasses = [CCClasses.CCSketch, CCClasses.CCWorkPlane]

const isPoint = (intersection: THREE.Intersection) => Boolean(intersection.object?.userData?.pointMap)
const isLine = (intersection: THREE.Intersection) => Boolean(intersection.object?.userData?.lineMap)

const findSuitableIntersection = (drawingId: DrawingID, intersections: THREE.Intersection[], lineThreshold: number, pointThreshold: number) => {
  let index = intersections.findIndex(i => i.object.userData?.objId || i.object.userData?.isBuerliGeometry)
  let intersection = intersections[index]
  if (!intersection) {
    return undefined
  }

  const tree = getDrawing(drawingId).structure.tree
  if (intersection.object.userData.objId) {
    return suitableCCClasses.some(ccClass => ccUtils.base.isA(tree[intersection.object.userData.objId]?.class, ccClass))
      ? intersection
      : undefined
  }

  const minDist = intersection.distance
  const maxThreshold = Math.max(lineThreshold, pointThreshold)
  
  while (intersections[index].distance - minDist < maxThreshold) {
    const intersectionNext = intersections[index]
    if (isPoint(intersectionNext) && intersectionNext.distance - minDist < pointThreshold) {
      // If we find a point within point threshold, just return it
      return intersectionNext
    }
    if (!isLine(intersection) && isLine(intersectionNext) && intersectionNext.distance - minDist < lineThreshold) {
      intersection = intersectionNext
    }
    index++
  }

  return intersection
}

const getGeometryNormal = (drawingId: DrawingID, intersection: THREE.Intersection, cameraRay: THREE.Ray) => {
  const object = intersection?.object
  if (!object) {
    return undefined
  }

  const drawing = getDrawing(drawingId)
  const productId = object.userData.productId

  const mW = drawing.api.structure.calculateGlobalTransformation(productId)
  const mN = new THREE.Matrix3().getNormalMatrix(mW)
  const mWInv = mW.clone().invert()
  const pos = intersection.point.clone().applyMatrix4(mWInv)
  const rayL = cameraRay.clone().applyMatrix4(mWInv)

  let normal = new THREE.Vector3(0, 0, 1)

  if (typeof intersection.index === 'number' && object.userData.pointMap) {
    const point = object.userData.pointMap[intersection.index]
    if (point) {
      // TODO: ???
    }
  } else if (typeof intersection.index === 'number' && object.userData.lineMap) {
    // Line
    const line = object.userData.lineMap[intersection.index || 0]
    if (line) {
      if (line.type === 'arc' || line.type === 'circle') {
        normal.copy(line.normal).normalize()
      }
      else {
        normal = getAdjacentMeshNormal(drawingId, line.graphicId, intersection, pos)
      }
    }
  } else if (typeof intersection.faceIndex === 'number' && Boolean(object.userData.meshMap)) {
    // Mesh
    const mesh = object.userData.meshMap[intersection.faceIndex || 0]
    if (mesh) {
      if (mesh.type === 'plane') {
        normal.copy(mesh.normal).normalize()
      } else if (mesh.type === 'cylinder') {
        const axis = mesh.axis.clone().normalize()
        const clickDir = mesh.origin.clone().sub(pos)
        const tangent = clickDir.clone().cross(axis).normalize()
        normal.copy(axis).cross(tangent).normalize()
      } else if (mesh.type === 'cone') {
        const posL = pos.clone().sub(mesh.origin)
        const bottomPlane = new THREE.Plane(mesh.axis)
        const posProj = new THREE.Vector3()
        bottomPlane.projectPoint(posL, posProj)
        posProj.setLength(mesh.radiusBottom)
        const slope = posL.clone().sub(posProj).normalize()
        const tangent = slope.clone().cross(posL).normalize()
        normal.copy(tangent).cross(slope).normalize()
      } else if (intersection.face) {
        normal.copy(intersection.face.normal).normalize()
      }
    }
  }

  if (normal.dot(rayL.direction) > 0) {
    normal.negate()
  }

  return normal.applyNormalMatrix(mN)
}

const convertToVector = (p: PointMem | undefined) => {
  return p ? new THREE.Vector3(p.value.x, p.value.y, p.value.z) : new THREE.Vector3()
}

const getSketchBounds = (boundsMember: ArrayMem) => {
  const [min, max] = boundsMember.members.map(memb => convertToVector(memb as PointMem))

  const box = new THREE.Box3(min, max)
  const sphere = new THREE.Sphere()
  box.getBoundingSphere(sphere)

  return { center: sphere.center, radius: sphere.radius, box }
}

const getMenuItems = (drawingId: DrawingID, info?: InteractionInfo): MenuProps['items'] => {
  const drawing = getDrawing(drawingId)
  const object = drawing.structure.tree[info?.objectId || -1]
  //const solid = drawing.geometry.cache[info.containerId || -1]
  //const mesh = solid?.meshes.find(mesh_ => mesh_.graphicId === info.graphicId)

  const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
  const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

  const common = [{ label: 'Zoom to fit', icon: <ZoomInOutlined />, key: 'zoomToFit' }]

  if (info?.graphicId) {
    return [
      ...common,
      { type: 'divider' },
      { label: 'View normal to', icon: <VerticalAlignTopOutlined />, key: 'viewNormalToProduct' },
      { label: 'Delete', icon: <DeleteOutlined />, key: isPartMode ? 'deleteSolid' : 'deleteNode' },
    ]
  }

  if (ccUtils.base.isA(object?.class, CCClasses.CCSketch)) {
    return [
      ...common,
      { type: 'divider' },
      { label: 'View normal to sketch', icon: <VerticalAlignTopOutlined />, key: 'viewNormalToSketch' },
      { label: 'Fit sketch', icon: <BorderOuterOutlined />, key: 'fitSketch' },
    ]
  }

  if (ccUtils.base.isA(object?.class, CCClasses.CCWorkPlane)) {
    return [
      ...common,
      { type: 'divider' },
      { label: 'View normal to plane', icon: <VerticalAlignTopOutlined />, key: 'viewNormalToPlane' },
    ]
  }

  return common
}

const getMenuHeader = (drawingId: DrawingID, info?: InteractionInfo) => {
  const drawing = getDrawing(drawingId)
  const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
  const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

  if (!info) {
    return isPartMode ? 'Part' : 'Assembly'
  }

  const object = drawing.structure.tree[info.objectId]

  if (info.graphicId) {
    return isPartMode ? 'Solid' : 'Product instance'
  }

  if (ccUtils.base.isA(object?.class, CCClasses.CCSketch)) {
    return 'Sketch'
  }

  if (ccUtils.base.isA(object?.class, CCClasses.CCWorkPlane)) {
    return 'Workplane'
  }

  return ''
}

const getMenuHeaderIconURL = (drawingId: DrawingID, info?: InteractionInfo) => {
  const drawing = getDrawing(drawingId)
  const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
  const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

  if (!info) {
    return isPartMode ? partURL : assemblyURL
  }

  const object = drawing.structure.tree[info.objectId]

  if (info.graphicId) {
    return isometricURL
  }

  if (ccUtils.base.isA(object.class, CCClasses.CCSketch)) {
    return sketchURL
  }

  if (ccUtils.base.isA(object?.class, CCClasses.CCWorkPlane)) {
    return workplaneURL
  }

  return ''
}

export const ContextMenu: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const lnTh = useThree(state => state.raycaster.params.Line?.threshold)
  const ptsTh = useThree(state => state.raycaster.params.Points?.threshold)
  const { camera, controls, size } = useThree()
  const { lineThreshold, pointThreshold } = React.useMemo(() => {
    return {
      lineThreshold: lnTh || CameraHelper.calculateScaleFactor(camera.position, 4, camera, size),
      pointThreshold: ptsTh || CameraHelper.calculateScaleFactor(camera.position, 6, camera, size),
    }
  }, [camera, size, lnTh, ptsTh])
  
  const boundsControls = useBounds()

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

    const intersection = findSuitableIntersection(drawingId, e.intersections, lineThreshold, pointThreshold)
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

  const onMenuClick = React.useCallback((e) => {
    if (!menuInfo) {
      return
    }

    switch (e.key) {
      case 'zoomToFit': {
        boundsControls?.refresh().reset().fit().clip()

        break
      }
      case 'viewNormalToProduct': {
        const target = menuInfo.clickPos
        const normal = menuInfo.clickNormal || new THREE.Vector3(0, 0, 1)
        const position = target.clone().addScaledVector(normal, camera.position.distanceTo(controls?.target))
        const up = normal.clone().cross(camera.up.clone().cross(normal))

        boundsControls?.refresh().moveTo(position).lookAt({ target, up })

        break
      }
      case 'deleteSolid': {
        const drawing = getDrawing(drawingId)
        const curProdId = drawing.structure.currentProduct
        const solidId = menuInfo.interactionInfo?.containerId
        if (!curProdId || !solidId) {
          return
        }

        const solidOwner = drawing.graphic.containers[solidId]?.owner
        
        const selectedInfo = drawing.interaction.selected || []
        const curSolids = drawing.structure.tree[curProdId]?.solids || []
        const selectedSolids = selectedInfo
          .filter(info => info.containerId && curSolids.indexOf(info.containerId) !== -1)
          .map(info => info.objectId as ObjectID)
        const ids = selectedSolids.indexOf(solidOwner) === -1 && curSolids.indexOf(solidId) !== -1 ? [...selectedSolids, solidOwner] : selectedSolids

        ccAPI.feature.createFeature(drawingId, curProdId, 'CC_EntityDeletion', 'Entity Deletion')
          .then(res => {
            if (res) {
              return ccAPI.feature.updateEntityDeletion(drawingId, res, ids)
            }

            return null
          })
          .catch(console.warn)

        drawing.api.interaction.setSelected([])

        break
      }
      case 'deleteNode': {
        const drawing = getDrawing(drawingId)
        const tree = drawing.structure.tree
        const nodeId = menuInfo.interactionInfo?.prodRefId
        if (!nodeId) {
          return
        }

        const selectedInfo = drawing.interaction.selected || []
        const selectedNodes = selectedInfo
          .filter(info => {
            const objClass = tree[info.prodRefId || -1]?.class
            return ccUtils.base.isA(objClass, CCClasses.IProductReference)
          })
          .map(info => info.prodRefId as ObjectID)
        const ids = selectedNodes.indexOf(nodeId) === -1 ? [...selectedNodes, nodeId] : selectedNodes
        const idsSorted = ids.sort((a, b) => b - a)

        ccAPI.baseModeler.deleteObjects(drawingId, idsSorted).catch(console.warn)

        break
      }
      case 'viewNormalToSketch': {
        const drawing = getDrawing(drawingId)
        const sketch = drawing.structure.tree[menuInfo.interactionInfo?.objectId || -1]
        if (!sketch || !ccUtils.base.isA(sketch.class, CCClasses.CCSketch)) {
          return
        }
        
        const boundsMember = sketch.members?.boundingBox as ArrayMem
        const bounds = getSketchBounds(boundsMember)

        const planeRef = sketch.members?.planeReference?.value as ObjectID
        const plane = drawing.structure.tree[planeRef]
        const origin = convertToVector(plane?.members?.curPosition as PointMem)
        const normal = convertToVector(plane?.members?.Normal as PointMem)
  
        const csys = sketch.coordinateSystem as number[][]
        const transformMatrix = MathUtils.convertToMatrix3(csys)
        const up = new THREE.Vector3(0, 1, 0).applyMatrix3(transformMatrix).normalize()
    
        // If box.min === box.max add (100, 100, 100) to box.max to make box not empty
        const box = bounds.box
        if (box.min.distanceTo(box.max) < 1e-6) {
          box.set(box.min, box.min.clone().add(new THREE.Vector3(100, 100, 100)))
        }

        const matrix4 = MathUtils.convertToMatrix4(csys)
        const globBox = box.clone().applyMatrix4(matrix4)
        const target = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin).projectPoint(menuInfo.clickPos, new THREE.Vector3())
        const position = target.clone().addScaledVector(normal, camera.position.distanceTo(controls?.target))

        boundsControls?.refresh(globBox).moveTo(position).lookAt({ target, up })

        break
      }
      case 'fitSketch': {
        const drawing = getDrawing(drawingId)
        const sketch = drawing.structure.tree[menuInfo.interactionInfo?.objectId || -1]
        if (!sketch || !ccUtils.base.isA(sketch.class, CCClasses.CCSketch)) {
          return
        }
        
        const boundsMember = sketch.members?.boundingBox as ArrayMem
        const bounds = getSketchBounds(boundsMember)
    
        const planeRef = sketch.members?.planeReference?.value as ObjectID
        const plane = drawing.structure.tree[planeRef]
        const normal = convertToVector(plane?.members?.Normal as PointMem).normalize()
  
        const csys = sketch.coordinateSystem as number[][]
        const transformMatrix = MathUtils.convertToMatrix3(csys)
        const up = new THREE.Vector3(0, 1, 0).applyMatrix3(transformMatrix).normalize()
    
        // If box.min === box.max add (100, 100, 100) to box.max to make box not empty
        const box = bounds.box
        if (box.min.distanceTo(box.max) < 1e-6) {
          box.set(box.min, box.min.clone().add(new THREE.Vector3(100, 100, 100)))
        }
    
        // Convert local box coordinates to global
        const matrix4 = MathUtils.convertToMatrix4(csys)
        const globBox = box.clone().applyMatrix4(matrix4)
        const target = bounds.center.clone().applyMatrix4(matrix4)
        const margin = 1.2
        const position = target.clone().addScaledVector(normal, bounds.radius * margin * 4)
    
        boundsControls?.refresh(globBox).moveTo(position).lookAt({ target, up }).fit().clip()

        break
      }
      case 'viewNormalToPlane': {
        const drawing = getDrawing(drawingId)
        const workPlaneObj = drawing.structure.tree[menuInfo.interactionInfo?.objectId || -1]
        if (!workPlaneObj || !ccUtils.base.isA(workPlaneObj.class, CCClasses.CCWorkPlane)) {
          return
        }

        const target = menuInfo.clickPos
        const normal = convertToVector(workPlaneObj.members?.Normal as PointMem).normalize()
        const position = target.clone().addScaledVector(normal, camera.position.distanceTo(controls?.target))
        const up = normal.clone().cross(camera.up.clone().cross(normal))

        boundsControls?.refresh().moveTo(position).lookAt({ target, up })

        break
      }
    }

    setMenuInfo(null)
  }, [drawingId, camera, controls, menuInfo, boundsControls])

  const menuItems = React.useMemo(() => menuInfo ? getMenuItems(drawingId, menuInfo.interactionInfo) : [], [drawingId, menuInfo])

  const caption = getMenuHeader(drawingId, menuInfo?.interactionInfo)
  const iconUrl = getMenuHeaderIconURL(drawingId, menuInfo?.interactionInfo)

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
                  <MenuHeaderIcon url={iconUrl} />
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
