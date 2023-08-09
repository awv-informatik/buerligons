import React from 'react'
import * as THREE from 'three'

import { ccAPI, ccUtils, CCClasses } from '@buerli.io/classcad'
import { DrawingID, getDrawing, MathUtils, ObjectID, PointMem, ArrayMem, GraphicType } from '@buerli.io/core'
import { MenuElement, getCADState, useOperationSequence } from '@buerli.io/react-cad'
import { useThree } from '@react-three/fiber'
import { ZoomInOutlined, VerticalAlignTopOutlined, BorderOuterOutlined, DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, SelectOutlined } from '@ant-design/icons'

import partURL from '@buerli.io/icons/SVG/part.svg'
import assemblyURL from '@buerli.io/icons/SVG/assembly.svg'
import isometricURL from '@buerli.io/icons/SVG/isometric.svg'
import sketchURL from '@buerli.io/icons/SVG/sketch.svg'
import workpointURL from '@buerli.io/icons/SVG/workpoint.svg'
import workaxisURL from '@buerli.io/icons/SVG/workaxis.svg'
import workplaneURL from '@buerli.io/icons/SVG/workplane.svg'
import workcsysURL from '@buerli.io/icons/SVG/workCSys.svg'

import { CanvasMenuInfo, MenuDescriptor } from './types'
import { MenuHeaderIcon } from './MenuHeaderIcon'
import { MenuItemIcon } from './MenuItemIcon'
import { useBounds, BoundsApi } from '../../Bounds'

type ControlsProto = {
  update(): void
  target: THREE.Vector3
}

const zoomToFit = (boundsControls: BoundsApi) => {
  boundsControls?.refresh().reset().fit().clip()
}

const hideFeatureOrSolid = (drawingId: DrawingID, menuInfo: CanvasMenuInfo) => {
  if (menuInfo.interactionInfo.containerId) {
    const geomApi = getDrawing(drawingId).api.geometry
    geomApi.setConfig(menuInfo.interactionInfo.containerId, { meshes: { hidden: true }, edges: { hidden: true } })
  }
  else {
    const pluginApi = getDrawing(drawingId).api.plugin
    pluginApi.setVisiblePlugin(menuInfo.interactionInfo.objectId, false)
  }

}

const showOrHideInstance = (drawingId: DrawingID, instanceId: ObjectID, show: boolean) => {
  const drawing = getDrawing(drawingId)
  drawing.api.geometry.setConfig(instanceId, { meshes: { hidden: !show }, edges: { hidden: !show } })

  const children = drawing.structure.tree[instanceId]?.children || []
  children.forEach(instanceId_ => showOrHideInstance(drawingId, instanceId_, show))
}

const showAllFeaturesAndSolids = (drawingId: DrawingID, opSeqId: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree
  
  const pluginAPI = drawing.api.plugin
  const featureRefIds = tree[opSeqId].children || []
  const featureIds = featureRefIds.map(featureRefId => tree[featureRefId]?.members?.refObj.value as ObjectID)
  featureIds.forEach(featureId => pluginAPI.setVisiblePlugin(featureId, true))

  const geomApi = drawing.api.geometry
  const curProd = drawing.structure.currentProduct
  const product = tree[curProd || -1]
  const solidIds = product?.solids || []
  solidIds.forEach(solidId => geomApi.setConfig(solidId, { meshes: { hidden: false }, edges: { hidden: false } }))
}

const showAllInstances = (drawingId: DrawingID) => {
  const drawing = getDrawing(drawingId)
  const curInstance = drawing.structure.currentInstance

  const children = drawing.structure.tree[curInstance || -1]?.children || []
  children.forEach(instanceId => showOrHideInstance(drawingId, instanceId, true))
}

const viewNormalToProduct = (menuInfo: CanvasMenuInfo, camera: THREE.Camera, controls: ControlsProto, boundsControls: BoundsApi) => {
  const target = menuInfo.clickInfo.clickPos
  const normal = menuInfo.clickInfo.clickNormal || new THREE.Vector3(0, 0, 1)
  const position = target.clone().addScaledVector(normal, camera.position.distanceTo(controls?.target))
  const up = normal.clone().cross(camera.up.clone().cross(normal))

  boundsControls?.refresh().moveTo(position).lookAt({ target, up })
}

const deleteSolid = (drawingId: DrawingID, menuInfo: CanvasMenuInfo) => {
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

const deleteInstance = (drawingId: DrawingID, menuInfo: CanvasMenuInfo) => {
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

const viewNormalToSketch = (drawingId: DrawingID, menuInfo: CanvasMenuInfo, camera: THREE.Camera, controls: ControlsProto, boundsControls: BoundsApi) => {
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
  const target = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin).projectPoint(menuInfo.clickInfo.clickPos, new THREE.Vector3())
  const position = target.clone().addScaledVector(normal, camera.position.distanceTo(controls?.target))

  boundsControls?.refresh(globBox).moveTo(position).lookAt({ target, up })
}

const fitSketch = (drawingId: DrawingID, menuInfo: CanvasMenuInfo, boundsControls: BoundsApi) => {
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

const newSketch = async (drawingId: DrawingID, menuInfo: CanvasMenuInfo) => {
  const drawing = getDrawing(drawingId)
  const curProdId = drawing.structure.currentProduct as ObjectID

  const sketchId = await ccAPI.sketcher.createSketch(drawingId, curProdId)
  if (!sketchId) {
    return
  }

  if (menuInfo.interactionInfo.graphicId) {
    await ccAPI.sketcher.createAndSetWorkPlane(drawingId, sketchId, menuInfo.interactionInfo.graphicId)
  }
  else {
    await ccAPI.sketcher.setWorkPlane(drawingId, sketchId, menuInfo.interactionInfo.objectId)
  }

  const pluginApi = drawing.api.plugin
  pluginApi.setActiveFeature(sketchId)
}

const viewNormalToPlane = (drawingId: DrawingID, menuInfo: CanvasMenuInfo, camera: THREE.Camera, controls: ControlsProto, boundsControls: BoundsApi) => {
  const drawing = getDrawing(drawingId)
  const workPlaneObj = drawing.structure.tree[menuInfo.interactionInfo?.objectId || -1]
  if (!workPlaneObj || !ccUtils.base.isA(workPlaneObj.class, CCClasses.CCWorkPlane)) {
    return
  }

  const target = menuInfo.clickInfo.clickPos
  const normal = convertToVector(workPlaneObj.members?.Normal as PointMem).normalize()
  const position = target.clone().addScaledVector(normal, camera.position.distanceTo(controls?.target))
  const up = normal.clone().cross(camera.up.clone().cross(normal))

  boundsControls?.refresh().moveTo(position).lookAt({ target, up })
}

export const useContextMenuItems = (drawingId: DrawingID): MenuDescriptor[] => {
  const drawing = getDrawing(drawingId)
  const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
  const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

  const camera = useThree(state => state.camera)
  const controls = useThree(state => state.controls as unknown as ControlsProto)

  const boundsControls = useBounds()

  const opSeqId = useOperationSequence(drawingId, drawing.structure.currentProduct || -1)

  return React.useMemo(() => {
    const zoomToFitEl = {
      label: 'Zoom to fit',
      icon: <ZoomInOutlined />,
      key: 'zoomToFit',
      onClick: (menuInfo: CanvasMenuInfo) => {
        zoomToFit(boundsControls)
      },
    } as MenuElement

    const hideEl = {
      label: 'Hide',
      icon: <EyeInvisibleOutlined />,
      key: 'hide',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (isPartMode) {
          hideFeatureOrSolid(drawingId, menuInfo)
        }
        else if (menuInfo.interactionInfo.prodRefId) {
          showOrHideInstance(drawingId, menuInfo.interactionInfo.prodRefId, false)
        }
      },
    } as MenuElement

    const showAllEl = {
      label: 'Show all',
      icon: <EyeOutlined />,
      key: 'showAll',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (isPartMode && opSeqId) {
          showAllFeaturesAndSolids(drawingId, opSeqId)
        }
        else {
          showAllInstances(drawingId)
        }
      }
    } as MenuElement

    const graphic = [
      hideEl,
      showAllEl,
      isPartMode ? null : { type: 'divider' },
      isPartMode ? null : {
        label: 'Edit',
        icon: <SelectOutlined />,
        key: 'editProduct',
        onClick: (menuInfo: CanvasMenuInfo) => {
          if (menuInfo.interactionInfo.prodRefId) {
            getCADState().api.assemblyTree.startProdEditing(drawingId, menuInfo.interactionInfo.prodRefId)
          }
        },
      },
      { type: 'divider' },
      zoomToFitEl,
      {
        label: 'View normal to',
        icon: <VerticalAlignTopOutlined />,
        key: 'viewNormalToProduct',
        onClick: (menuInfo: CanvasMenuInfo) => {
          viewNormalToProduct(menuInfo, camera, controls, boundsControls)
        },
      },
      { type: 'divider' },
      {
        label: 'Delete',
        icon: <DeleteOutlined />,
        key: 'delete',
        onClick: (menuInfo: CanvasMenuInfo) => {
          if (isPartMode) {
            deleteSolid(drawingId, menuInfo)
          }
          else {
            deleteInstance(drawingId, menuInfo)
          }
        },
      },
    ] as MenuElement[]

    const grDescriptor = {
      headerName: isPartMode ? 'Solid' : 'Product instance',
      headerIcon: <MenuHeaderIcon url={isometricURL} />,
      menuElements: graphic,
    }

    const workGeometry = [
      hideEl,
      showAllEl,
      { type: 'divider' },
      zoomToFitEl,
    ] as MenuElement[]

    return [
      { objType: GraphicType.POINT, ...grDescriptor },
      { objType: GraphicType.CURVEPOINT, ...grDescriptor },
      { objType: GraphicType.LINE, ...grDescriptor },
      { objType: GraphicType.ARC, ...grDescriptor },
      { objType: GraphicType.CIRCLE, ...grDescriptor },
      { objType: GraphicType.NURBSCURVE, ...grDescriptor },
      {
        objType: GraphicType.PLANE,
        ...grDescriptor,
        menuElements: [
          isPartMode ? {
            label: 'New Sketch',
            icon: <MenuItemIcon url={sketchURL} />,
            key: 'newSketch',
            onClick: (menuInfo: CanvasMenuInfo) => {
              newSketch(drawingId, menuInfo)
            },
          } : null,
          isPartMode ? { type: 'divider' } : null,
          ...graphic,
        ]
      } as MenuDescriptor,
      { objType: GraphicType.CYLINDER, ...grDescriptor },
      { objType: GraphicType.CONE, ...grDescriptor },
      { objType: GraphicType.SPHERE, ...grDescriptor },
      { objType: GraphicType.NURBSSURFACE, ...grDescriptor },
      {
        objType: CCClasses.CCPart,
        headerName: 'Part',
        headerIcon: <MenuHeaderIcon url={partURL} />,
        menuElements: [showAllEl, { type: 'divider' }, zoomToFitEl],
      },
      {
        objType: CCClasses.CCAssembly,
        headerName: 'Assembly',
        headerIcon: <MenuHeaderIcon url={assemblyURL} />,
        menuElements: [showAllEl, { type: 'divider' }, zoomToFitEl],
      },
      {
        objType: CCClasses.CCSketch,
        headerName: 'Sketch',
        headerIcon: <MenuHeaderIcon url={sketchURL} />,
        menuElements: [
          zoomToFitEl,
          { type: 'divider' },
          {
            label: 'View normal to sketch',
            icon: <VerticalAlignTopOutlined />,
            key: 'viewNormalToSketch',
            onClick: (menuInfo: CanvasMenuInfo) => {
              viewNormalToSketch(drawingId, menuInfo, camera, controls, boundsControls)
            },
          },
          {
            label: 'Fit sketch',
            icon: <BorderOuterOutlined />,
            key: 'fitSketch',
            onClick: (menuInfo: CanvasMenuInfo) => {
              fitSketch(drawingId, menuInfo, boundsControls)
            },
          },
        ] as MenuElement[],
      },
      {
        objType: CCClasses.CCWorkPoint,
        headerName: 'Workpoint',
        headerIcon: <MenuHeaderIcon url={workpointURL} />,
        menuElements: workGeometry,
      },
      {
        objType: CCClasses.CCWorkAxis,
        headerName: 'Workaxis',
        headerIcon: <MenuHeaderIcon url={workaxisURL} />,
        menuElements: workGeometry,
      },
      {
        objType: CCClasses.CCWorkPlane,
        headerName: 'Workplane',
        headerIcon: <MenuHeaderIcon url={workplaneURL} />,
        menuElements: [
          {
            label: 'New sketch',
            icon: <MenuItemIcon url={sketchURL} />,
            key: 'newSketch',
            onClick: (menuInfo: CanvasMenuInfo) => {
              newSketch(drawingId, menuInfo)
            },
          },
          { type: 'divider' },
          ...workGeometry,
          {
            label: 'View normal to plane',
            icon: <VerticalAlignTopOutlined />,
            key: 'viewNormalToPlane',
            onClick: (menuInfo: CanvasMenuInfo) => {
              viewNormalToPlane(drawingId, menuInfo, camera, controls, boundsControls)
            },
          },
        ] as MenuElement[],
      },
      {
        objType: CCClasses.CCWorkCSys,
        headerName: 'Workcsys',
        headerIcon: <MenuHeaderIcon url={workcsysURL} />,
        menuElements: workGeometry,
      },
      {
        objType: CCClasses.CCWorkCoordSystem,
        headerName: 'Workcsys',
        headerIcon: <MenuHeaderIcon url={workcsysURL} />,
        menuElements: workGeometry,
      },
    ]
  }, [drawingId, isPartMode, camera, controls, boundsControls])
}
