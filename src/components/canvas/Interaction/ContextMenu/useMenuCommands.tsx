import React from 'react'
import * as THREE from 'three'

import { ccAPI, ccUtils, CCClasses } from '@buerli.io/classcad'
import { DrawingID, getDrawing, MathUtils, ObjectID, PointMem, ArrayMem } from '@buerli.io/core'
import { useThree } from '@react-three/fiber'
import { ZoomInOutlined, VerticalAlignTopOutlined, BorderOuterOutlined, DeleteOutlined } from '@ant-design/icons'

import partURL from '@buerli.io/icons/SVG/part.svg'
import assemblyURL from '@buerli.io/icons/SVG/assembly.svg'
import isometricURL from '@buerli.io/icons/SVG/isometric.svg'
import sketchURL from '@buerli.io/icons/SVG/sketch.svg'
import workplaneURL from '@buerli.io/icons/SVG/workplane.svg'

import { MenuInfo, MenuDescriptor, MenuElement } from './types'
import { MenuHeaderIcon } from './MenuHeaderIcon'
import { useBounds, BoundsApi } from '../../Bounds'

type ControlsProto = {
  update(): void
  target: THREE.Vector3
}

const zoomToFit = (boundsControls: BoundsApi) => {
  boundsControls?.refresh().reset().fit().clip()
}

const viewNormalToProduct = (menuInfo: MenuInfo, camera: THREE.Camera, controls: ControlsProto, boundsControls: BoundsApi) => {
  const target = menuInfo.clickPos
  const normal = menuInfo.clickNormal || new THREE.Vector3(0, 0, 1)
  const position = target.clone().addScaledVector(normal, camera.position.distanceTo(controls?.target))
  const up = normal.clone().cross(camera.up.clone().cross(normal))

  boundsControls?.refresh().moveTo(position).lookAt({ target, up })
}

const deleteSolid = (drawingId: DrawingID, menuInfo: MenuInfo) => {
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
}

const deleteInstance = (drawingId: DrawingID, menuInfo: MenuInfo) => {
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

const viewNormalToSketch = (drawingId: DrawingID, menuInfo: MenuInfo, camera: THREE.Camera, controls: ControlsProto, boundsControls: BoundsApi) => {
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
}

const fitSketch = (drawingId: DrawingID, menuInfo: MenuInfo, boundsControls: BoundsApi) => {
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
}

const viewNormalToPlane = (drawingId: DrawingID, menuInfo: MenuInfo, camera: THREE.Camera, controls: ControlsProto, boundsControls: BoundsApi) => {
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
}

export const useMenuCommands = (drawingId: DrawingID): MenuDescriptor[] => {
  const drawing = getDrawing(drawingId)
  const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
  const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

  const camera = useThree(state => state.camera)
  const controls = useThree(state => state.controls as unknown as ControlsProto)

  const boundsControls = useBounds()

  return React.useMemo(() => {
    const common = [
      {
        label: 'Zoom to fit',
        icon: <ZoomInOutlined />,
        key: 'zoomToFit',
        onClick: (menuInfo: MenuInfo) => {
          zoomToFit(boundsControls)
        },
      }
    ] as MenuElement[]

    const graphic = [
      {
        label: 'View normal to',
        icon: <VerticalAlignTopOutlined />,
        key: 'viewNormalToProduct',
        onClick: (menuInfo: MenuInfo) => {
          viewNormalToProduct(menuInfo, camera, controls, boundsControls)
        },
      },
      {
        label: 'Delete',
        icon: <DeleteOutlined />,
        key: 'delete',
        onClick: (menuInfo: MenuInfo) => {
          if (isPartMode) {
            deleteSolid(drawingId, menuInfo)
          }
          else {
            deleteInstance(drawingId, menuInfo)
          }
        },
      },
    ] as MenuElement[]

    return [
      {
        objType: 'background',
        headerName: isPartMode ? 'Part' : 'Assembly',
        headerIcon: <MenuHeaderIcon url={isPartMode ? partURL : assemblyURL} />,
        menuElements: common,
      },
      {
        objType: 'point',
        headerName: isPartMode ? 'Solid' : 'Product instance',
        headerIcon: <MenuHeaderIcon url={isometricURL} />,
        menuElements: [...common, { type: 'divider' }, ...graphic],
      },
      {
        objType: 'line',
        headerName: isPartMode ? 'Solid' : 'Product instance',
        headerIcon: <MenuHeaderIcon url={isometricURL} />,
        menuElements: [...common, { type: 'divider' }, ...graphic],
      },
      {
        objType: 'mesh',
        headerName: isPartMode ? 'Solid' : 'Product instance',
        headerIcon: <MenuHeaderIcon url={isometricURL} />,
        menuElements: [...common, { type: 'divider' }, ...graphic],
      },
      {
        objType: CCClasses.CCSketch,
        headerName: 'Sketch',
        headerIcon: <MenuHeaderIcon url={sketchURL} />,
        menuElements: [
          ...common,
          { type: 'divider' },
          {
            label: 'View normal to sketch',
            icon: <VerticalAlignTopOutlined />,
            key: 'viewNormalToSketch',
            onClick: (menuInfo: MenuInfo) => {
              viewNormalToSketch(drawingId, menuInfo, camera, controls, boundsControls)
            },
          },
          {
            label: 'Fit sketch',
            icon: <BorderOuterOutlined />,
            key: 'fitSketch',
            onClick: (menuInfo: MenuInfo) => {
              fitSketch(drawingId, menuInfo, boundsControls)
            },
          },
        ] as MenuElement[],
      },
      {
        objType: CCClasses.CCWorkPlane,
        headerName: 'Workplane',
        headerIcon: <MenuHeaderIcon url={workplaneURL} />,
        menuElements: [
          ...common,
          { type: 'divider' },
          {
            label: 'View normal to plane',
            icon: <VerticalAlignTopOutlined />,
            key: 'viewNormalToPlane',
            onClick: (menuInfo: MenuInfo) => {
              viewNormalToPlane(drawingId, menuInfo, camera, controls, boundsControls)
            },
          },
        ] as MenuElement[],
      },
    ]
  }, [drawingId, isPartMode, camera, controls, boundsControls])
}
