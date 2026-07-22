/* eslint-disable max-lines */
import React from 'react'
import * as THREE from 'three'

import { createApi, ccUtils, ScgClassType, ScgGraphicType } from '@buerli.io/classcad'
import {
  DrawingID,
  getDrawing,
  ObjectID,
  ScgPointMem,
  createInfo,
  InteractionInfo,
  BuerliScope,
  GeometryElement,
} from '@buerli.io/core'
import {
  MenuElement,
  TreeObjScope,
  conversionUtils,
  createTreeObjSelItem,
  getCADState,
  sketchUtils,
  useOperationSequence,
} from '@buerli.io/react-cad'
import { useThree } from '@react-three/fiber'
import { useBounds, BoundsApi } from '@react-three/drei'
import {
  ZoomInOutlined,
  VerticalAlignTopOutlined,
  BorderOuterOutlined,
  CommentOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  SelectOutlined,
  BgColorsOutlined,
} from '@ant-design/icons'

import partURL from '@buerli.io/icons/SVG/part.svg'
import arcURL from '@buerli.io/icons/SVG/arc-center.svg'
import assemblyURL from '@buerli.io/icons/SVG/assembly.svg'
import circleURL from '@buerli.io/icons/SVG/circle-center-radius.svg'
import constraintURL from '@buerli.io/icons/SVG/dimension.svg'
import fastenedURL from '@buerli.io/icons/SVG/fastened.svg'
import groupURL from '@buerli.io/icons/SVG/group.svg'
import isometricURL from '@buerli.io/icons/SVG/isometric.svg'
import lineURL from '@buerli.io/icons/SVG/line.svg'
import pointURL from '@buerli.io/icons/SVG/point.svg'
import sketchURL from '@buerli.io/icons/SVG/sketch.svg'
import workpointURL from '@buerli.io/icons/SVG/workpoint.svg'
import workaxisURL from '@buerli.io/icons/SVG/workaxis.svg'
import workplaneURL from '@buerli.io/icons/SVG/workplane.svg'
import workcsysURL from '@buerli.io/icons/SVG/workCSys.svg'

import { startAnnotationDraft } from '../../../../annotations/annotations'
import { useSessionRole } from '../../../../session/sessionClient'
import { CanvasMenuInfo, MenuDescriptor } from './types'
import {
  getInteractionInfo,
  getSelectedInstances,
  getSelectedSolids,
  getUniqueSelIntersections,
  getWCSystems,
} from './utils'
import { MenuHeaderIcon } from './MenuHeaderIcon'
import { MenuItemIcon } from './MenuItemIcon'
import { attemptSSelection, getBuerliGeometry } from '../utils'

type ControlsProto = {
  update(): void
  target: THREE.Vector3
}

const getBuerliGeometryName = (
  drawingId: DrawingID,
  productId: ObjectID,
  geom: GeometryElement,
  isPartMode: boolean,
) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree
  const selection = drawing.selection.refs[drawing.selection.active || -1]
  const instanceId = ccUtils.assembly.getMatePath(drawingId, productId).pop() || -1
  const instance = tree[instanceId]
  const instanceName = tree[instanceId]?.name
  const solidName = tree[geom?.container.ownerId || -1]?.name || ''
  const isInstanceSelectable =
    instance && selection ? selection.isSelectable(TreeObjScope, { object: instance }) : false
  const isSolidSelectable = geom && selection ? selection.isSelectable(BuerliScope, geom.container.type) : false
  const geomSuffix = isInstanceSelectable || isSolidSelectable ? '' : ' ' + geom.type

  return (isPartMode ? solidName : instanceName) + geomSuffix
}

const getIconURL = (drawingId: DrawingID, objectId: ObjectID | undefined) => {
  const tree = getDrawing(drawingId).structure.tree
  const treeObj = tree[objectId || -1]
  if (!treeObj) {
    return isometricURL
  }

  if (ccUtils.base.isA(treeObj.class, ScgClassType.CCPoint)) {
    return pointURL
  }

  if (ccUtils.base.isA(treeObj.class, ScgClassType.CCLine)) {
    return lineURL
  }

  if (ccUtils.base.isA(treeObj.class, ScgClassType.CCArc)) {
    return arcURL
  }

  if (ccUtils.base.isA(treeObj.class, ScgClassType.CCCircle)) {
    return circleURL
  }

  if (ccUtils.base.isA(treeObj.class, ScgClassType.CC2DConstraint)) {
    return constraintURL
  }

  if (ccUtils.base.isA(treeObj.class, ScgClassType.CCWorkPoint)) {
    return workpointURL
  }

  if (ccUtils.base.isA(treeObj.class, ScgClassType.CCWorkAxis)) {
    return workaxisURL
  }

  if (ccUtils.base.isA(treeObj.class, ScgClassType.CCWorkPlane)) {
    return workplaneURL
  }

  if (
    ccUtils.base.isA(treeObj.class, ScgClassType.CCWorkCSys) ||
    ccUtils.base.isA(treeObj.class, ScgClassType.CCWorkCoordSystem)
  ) {
    return workcsysURL
  }

  return isometricURL
}

const zoomToFit = (boundsControls: BoundsApi) => {
  boundsControls?.refresh().reset().fit().clip()
}

const editAppearance = (drawingId: DrawingID, solidId: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const curProdId = drawing.structure.currentProduct
  const gPluginIds = drawing.plugin.global
  const editAppearanceId = gPluginIds.find(id => drawing.plugin.refs[id].name === 'Appearance Editor')
  if (!curProdId || !editAppearanceId) {
    return
  }

  const solidIds = getSelectedSolids(drawingId, solidId, false)

  const editAppearancePl = drawing.plugin.refs[editAppearanceId]
  editAppearancePl.set({ solidIds })

  const pluginApi = drawing.api.plugin
  pluginApi.setActiveGlobal(editAppearanceId, true)
}

const createFix = (drawingId: DrawingID, instanceId: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const curProdId = drawing.structure.currentProduct
  const tree = drawing.structure.tree
  if (!curProdId) {
    return
  }

  // TODO: Make it work for all the selected instances. A function for multiple constraint creation is required!
  const productId = (tree[instanceId]?.members?.productId?.value as ObjectID) || instanceId
  const wcSystems1 = getWCSystems(drawingId, curProdId)
  const wcSystems2 = getWCSystems(drawingId, productId)
  if (wcSystems1.length === 0 || wcSystems2.length === 0) {
    return
  }

  const matePath = ccUtils.assembly.getMatePath(drawingId, instanceId)
  const mate1 = { path: [], csys: wcSystems1[0] }
  const mate2 = { path: matePath, csys: wcSystems2[0] }
  createApi(drawingId)
    .v1.assembly.fastened({ id: curProdId, name: 'Fix', mate1, mate2, useCurrentTransform: true })
    .catch(console.warn)
}

const createGroup = (drawingId: DrawingID, instanceId: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const curProdId = drawing.structure.currentProduct
  if (!curProdId) {
    return
  }

  const instanceIds = getSelectedInstances(drawingId, instanceId)

  createApi(drawingId).v1.assembly.group({ id: curProdId, name: 'Group', instanceIds }).catch(console.warn)
}

const hoverObject = (drawingId: DrawingID, info: InteractionInfo | null) => {
  const setHovered = getDrawing(drawingId).api.interaction.setHovered
  setHovered(info)
}

const selectTreeObj = (drawingId: DrawingID, objectId: ObjectID, multi: boolean) => {
  const drawing = getDrawing(drawingId)
  const productId = drawing.structure.currentProduct
  let object = drawing.structure.tree[objectId]
  const selection = drawing.selection.refs[drawing.selection.active || '']
  const isSelActive = selection !== undefined
  const isSelectable = selection?.isSelectable(TreeObjScope, { object }) || false

  if ((isSelActive && !isSelectable) || !productId) {
    return
  }

  if (selection) {
    if (ccUtils.base.isA(object.class, ScgClassType.IProductReference)) {
      const instanceId = ccUtils.assembly.getMatePath(drawingId, object.id).pop() || -1
      object = drawing.structure.tree[instanceId]
    }

    if (selection.isSelectable(TreeObjScope, { object })) {
      const item = createTreeObjSelItem(productId, object)

      const selApi = drawing.api.selection
      selApi.isItemSelected(item) ? selApi.unselect(item) : selApi.select(item)
    }

    return
  }

  const select = drawing.api.interaction.select
  select(createInfo({ objectId, prodRefId: productId }), multi)
}

const selectGrObj = (drawingId: DrawingID, productId: ObjectID, geom: GeometryElement, multi: boolean) => {
  const drawing = getDrawing(drawingId)
  const isSelActive = drawing.selection.active !== null

  if (isSelActive) {
    attemptSSelection(drawingId, productId, geom)
    return
  }

  const interactionInfo = createInfo({
    objectId: geom.container.ownerId,
    graphicId: geom.graphicId,
    containerId: geom.container.id,
    prodRefId: productId,
  })

  const select = drawing.api.interaction.select
  select(interactionInfo, multi)
}

const hideFeatureOrSolid = (drawingId: DrawingID, menuInfo: CanvasMenuInfo) => {
  if (menuInfo.interactionInfo.containerId) {
    const geomApi = getDrawing(drawingId).api.geometry
    geomApi.setConfig(menuInfo.interactionInfo.containerId, {
      meshes: { hidden: true },
      edges: { hidden: true },
      disabled: true,
    })
  } else {
    const pluginApi = getDrawing(drawingId).api.plugin
    pluginApi.setVisiblePlugin(menuInfo.interactionInfo.objectId, false)
  }
}

const showOrHideInstance = (drawingId: DrawingID, instanceId: ObjectID, show: boolean) => {
  const drawing = getDrawing(drawingId)
  if (!ccUtils.base.isA(drawing.structure.tree[instanceId]?.class, ScgClassType.IProductReference)) {
    return
  }

  drawing.api.geometry.setConfig(
    instanceId,
    show ? null : { meshes: { hidden: true }, edges: { hidden: true }, disabled: true },
  )

  const children = drawing.structure.tree[instanceId]?.children || []
  children.forEach(instanceId_ => showOrHideInstance(drawingId, instanceId_, show))
}

const hideOtherFeatures = (drawingId: DrawingID, opSeqId: ObjectID, featureId: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const pluginAPI = drawing.api.plugin
  const featureRefIds = tree[opSeqId].children || []
  const featureIds = featureRefIds.map(featureRefId => tree[featureRefId]?.members?.refObj.value as ObjectID)
  featureIds.forEach(id => id !== featureId && pluginAPI.setVisiblePlugin(id, false))
}

const hideOtherSolids = (drawingId: DrawingID, solidId: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const geomApi = drawing.api.geometry
  const curProd = drawing.structure.currentProduct
  const product = tree[curProd || -1]
  const solidIds = product?.solids || []
  solidIds.forEach(
    id =>
      id !== solidId && geomApi.setConfig(id, { meshes: { hidden: true }, edges: { hidden: true }, disabled: true }),
  )
}

const hideOtherInstances = (drawingId: DrawingID, instanceId: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const curInstance = drawing.structure.currentInstance
  const tree = drawing.structure.tree

  const descendants = ccUtils.base.getDescendants(drawingId, curInstance || -1)
  const instances = descendants.filter(id => ccUtils.base.isA(tree[id].class, ScgClassType.IProductReference))
  const instDescendants = ccUtils.base.getDescendants(drawingId, instanceId)
  const ancestors = ccUtils.base.getAncestors(drawingId, instanceId)

  const instancesToHide = instances.filter(
    id => instDescendants.indexOf(id) === -1 && ancestors.indexOf(id) === -1 && id !== instanceId,
  )
  instancesToHide.forEach(id =>
    drawing.api.geometry.setConfig(id, { meshes: { hidden: true }, edges: { hidden: true }, disabled: true }),
  )
}

const showOrHideAllFeatures = (drawingId: DrawingID, opSeqId: ObjectID, show: boolean) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const pluginAPI = drawing.api.plugin
  const featureRefIds = tree[opSeqId].children || []
  const featureIds = featureRefIds.map(featureRefId => tree[featureRefId]?.members?.refObj.value as ObjectID)
  featureIds.forEach(featureId => pluginAPI.setVisiblePlugin(featureId, show))
}

const showOrHideAllSolids = (drawingId: DrawingID, show: boolean) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const geomApi = drawing.api.geometry
  const curProd = drawing.structure.currentProduct
  const product = tree[curProd || -1]
  const solidIds = product?.solids || []
  solidIds.forEach(solidId =>
    geomApi.setConfig(solidId, show ? null : { meshes: { hidden: true }, edges: { hidden: true }, disabled: true }),
  )
}

const showAllFeaturesAndSolids = (drawingId: DrawingID, opSeqId: ObjectID) => {
  showOrHideAllFeatures(drawingId, opSeqId, true)
  showOrHideAllSolids(drawingId, true)
}

const showOrHideAllInstances = (drawingId: DrawingID, show: boolean) => {
  const drawing = getDrawing(drawingId)
  const curInstance = drawing.structure.currentInstance

  const children = drawing.structure.tree[curInstance || -1]?.children || []
  children.forEach(instanceId => showOrHideInstance(drawingId, instanceId, show))
}

const showOrHideMates = (drawingId: DrawingID, instanceId: ObjectID, show: boolean) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const instanceIds = getSelectedInstances(drawingId, instanceId)
  const mateIdsArr = instanceIds.map(instanceId_ => {
    const productId = (tree[instanceId_]?.members?.productId?.value as ObjectID) || instanceId_
    const prodChildren = tree[productId]?.children || []
    const geomSetId = prodChildren.find(id => ccUtils.base.isA(tree[id]?.class, ScgClassType.CCGeometrySet))
    const geomSetChildren = tree[geomSetId || -1]?.children || []
    return geomSetChildren.filter(
      id =>
        ccUtils.base.isA(tree[id].class, ScgClassType.CCWorkCSys) ||
        ccUtils.base.isA(tree[id].class, ScgClassType.CCWorkCoordSystem),
    )
  })

  getCADState().api.assemblyTree.setVisible(instanceIds, mateIdsArr, show)
}

const viewNormalToProduct = (
  menuInfo: CanvasMenuInfo,
  camera: THREE.Camera,
  controls: ControlsProto,
  boundsControls: BoundsApi,
) => {
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

  const ids = getSelectedSolids(drawingId, solidId, true)
  const targets = conversionUtils.solidsV1(drawingId, ids)

  createApi(drawingId)
    .v1.part.entityDeletion({ id: curProdId, name: 'Entity Deletion', targets })
    .catch(console.warn)

  drawing.api.interaction.setSelected([])
}

const deleteInstance = (drawingId: DrawingID, menuInfo: CanvasMenuInfo) => {
  const instanceId = menuInfo.interactionInfo?.prodRefId
  if (!instanceId) {
    return
  }

  const ids = getSelectedInstances(drawingId, instanceId)
  const idsSorted = ids.sort((a, b) => b - a)

  createApi(drawingId).v1.assembly.deleteInstance({ ids: idsSorted }).catch(console.warn)
}

const viewNormalToSketch = (
  drawingId: DrawingID,
  menuInfo: CanvasMenuInfo,
  camera: THREE.Camera,
  controls: ControlsProto,
  boundsControls: BoundsApi,
) => {
  const sketchId = sketchUtils.getSketchId(drawingId, menuInfo.interactionInfo.objectId)
  const sketchFitInfo = sketchUtils.getSketchNormalViewInfo(
    drawingId,
    sketchId,
    menuInfo.clickInfo.clickPos,
    camera.position.distanceTo(controls?.target),
  )
  if (!sketchFitInfo) {
    return
  }

  const { globBox, position, target, up } = sketchFitInfo
  boundsControls?.refresh(globBox).moveTo(position).lookAt({ target, up })
}

const fitSketch = (drawingId: DrawingID, menuInfo: CanvasMenuInfo, boundsControls: BoundsApi) => {
  const margin = 1.2
  const sketchId = sketchUtils.getSketchId(drawingId, menuInfo.interactionInfo.objectId)
  const sketchFitInfo = sketchUtils.getSketchFitInfo(drawingId, sketchId, margin * 4)
  if (!sketchFitInfo) {
    return
  }

  const { globBox, position, target, up } = sketchFitInfo
  boundsControls?.refresh(globBox).moveTo(position).lookAt({ target, up }).fit().clip()
}

const newSketch = async (drawingId: DrawingID, menuInfo: CanvasMenuInfo) => {
  const drawing = getDrawing(drawingId)
  const curProdId = drawing.structure.currentProduct as ObjectID
  const planeId = menuInfo.interactionInfo.graphicId || menuInfo.interactionInfo.objectId

  const res = await createApi(drawingId).v1.sketch.create({ id: curProdId, planeId })
  if (!res.result) {
    return
  }

  const pluginApi = drawing.api.plugin
  pluginApi.setActiveFeature(res.result)
}

const convertToVector = (p: ScgPointMem | undefined) => {
  return p ? new THREE.Vector3(p.value.x, p.value.y, p.value.z) : new THREE.Vector3()
}

const viewNormalToPlane = (
  drawingId: DrawingID,
  menuInfo: CanvasMenuInfo,
  camera: THREE.Camera,
  controls: ControlsProto,
  boundsControls: BoundsApi,
) => {
  const drawing = getDrawing(drawingId)
  const workPlaneObj = drawing.structure.tree[menuInfo.interactionInfo?.objectId || -1]
  if (!workPlaneObj || !ccUtils.base.isA(workPlaneObj.class, ScgClassType.CCWorkPlane)) {
    return
  }

  const target = menuInfo.clickInfo.clickPos
  const normal = convertToVector(workPlaneObj.members?.Normal as ScgPointMem).normalize()
  const position = target.clone().addScaledVector(normal, camera.position.distanceTo(controls?.target))
  const up = normal.clone().cross(camera.up.clone().cross(normal))

  boundsControls?.refresh().moveTo(position).lookAt({ target, up })
}

// Keys of the context-menu items that mutate the model; stripped for view-only guests.
const MUTATING_MENU_KEYS = new Set(['editAppearance', 'fix', 'group', 'editProduct', 'delete', 'newSketch'])

// Drops mutating items from a menu and collapses the dividers they leave behind.
const stripMutatingItems = (els: MenuElement[]): MenuElement[] => {
  const isDivider = (el: MenuElement) => Boolean(el) && (el as { type?: string }).type === 'divider'
  const kept = (els || []).filter(el => {
    const key = el ? (el as { key?: string }).key : undefined
    return !(key && MUTATING_MENU_KEYS.has(key))
  })
  const out: MenuElement[] = []
  for (const el of kept) {
    if (isDivider(el) && (out.length === 0 || isDivider(out[out.length - 1]))) continue
    out.push(el)
  }
  while (out.length && isDivider(out[out.length - 1])) out.pop()
  return out
}

export const useContextMenuItems = (drawingId: DrawingID): MenuDescriptor[] => {
  const drawing = getDrawing(drawingId)
  const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
  const isPartMode = ccUtils.base.isA(prodClass, ScgClassType.CCPart)
  const readOnly = useSessionRole() === 'view'

  const camera = useThree(state => state.camera)
  const controls = useThree(state => state.controls as unknown as ControlsProto)

  const boundsControls = useBounds()

  const opSeqId = useOperationSequence(drawingId, drawing.structure.currentProduct || -1)

  const multi = React.useRef<boolean>(false)
  React.useEffect(() => {
    const handleMulti = (e: KeyboardEvent) => (multi.current = e.ctrlKey || e.shiftKey)

    document.addEventListener('keydown', handleMulti, true)
    document.addEventListener('keyup', handleMulti, true)

    return () => {
      document.removeEventListener('keydown', handleMulti, true)
      document.removeEventListener('keyup', handleMulti, true)
    }
  })

  return React.useMemo(() => {
    const zoomToFitEl = {
      label: 'Zoom to fit',
      icon: <ZoomInOutlined />,
      key: 'zoomToFit',
      onClick: (menuInfo: CanvasMenuInfo) => {
        zoomToFit(boundsControls)
      },
    } as MenuElement

    const editAppearanceEl = {
      label: 'Edit appearance',
      icon: <BgColorsOutlined />,
      key: 'editAppearance',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (menuInfo.interactionInfo.containerId) {
          editAppearance(drawingId, menuInfo.interactionInfo.containerId)
        }
      },
    }

    const fixEl = {
      label: 'Fix',
      icon: <MenuItemIcon url={fastenedURL} />,
      key: 'fix',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (menuInfo.interactionInfo.prodRefId) {
          createFix(drawingId, menuInfo.interactionInfo.prodRefId)
        }
      },
    }

    const groupEl = {
      label: 'Group',
      icon: <MenuItemIcon url={groupURL} />,
      key: 'group',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (menuInfo.interactionInfo.prodRefId) {
          createGroup(drawingId, menuInfo.interactionInfo.prodRefId)
        }
      },
    }

    const selectEl = {
      label: 'Select',
      icon: <SelectOutlined />,
      key: 'select',
      children: (menuInfo: CanvasMenuInfo) => {
        const drawing_ = getDrawing(drawingId)
        const tree = drawing_.structure.tree

        let intersections = menuInfo.clickInfo.intersections

        const selection = drawing_.selection.refs[drawing_.selection.active || '']
        const isSelActive = selection !== undefined
        if (isSelActive) {
          intersections = getUniqueSelIntersections(intersections, drawingId)
        } else if (sketchUtils.isSketchActive(drawingId)) {
          intersections = intersections.filter(i => {
            const treeObj = tree[i.object.userData?.objId || -1]
            return treeObj && (sketchUtils.isSketchGeometry(treeObj) || sketchUtils.is2DConstraint(treeObj))
          })
        }

        return intersections.map((i, idx) => {
          const objId = i.object.userData.objId
          const treeObj = tree[objId]
          const geom = getBuerliGeometry(i)
          const isTreeObj = treeObj !== undefined
          const label = isTreeObj
            ? treeObj.name
            : getBuerliGeometryName(drawingId, i.object.userData.productId, geom as GeometryElement, isPartMode)

          return {
            label,
            icon: <MenuItemIcon url={getIconURL(drawingId, objId)} />,
            key: 'select' + idx,
            onClick: () => {
              if (isTreeObj) {
                selectTreeObj(drawingId, objId, multi.current)
              } else if (geom) {
                selectGrObj(drawingId, i.object.userData.productId, geom, multi.current)
              }
            },
            onMouseEnter: () => {
              const info = getInteractionInfo(drawingId, i)
              if (info) {
                hoverObject(drawingId, info)
              }
            },
            onMouseLeave: () => {
              hoverObject(drawingId, null)
            },
          }
        })
      },
    }

    const hideEl = {
      label: 'Hide',
      icon: <EyeInvisibleOutlined />,
      key: 'hide',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (isPartMode) {
          hideFeatureOrSolid(drawingId, menuInfo)
        } else if (menuInfo.interactionInfo.prodRefId) {
          showOrHideInstance(drawingId, menuInfo.interactionInfo.prodRefId, false)
        }
      },
    } as MenuElement

    const hideOtherFeaturesEl = {
      label: 'Hide other features',
      icon: <EyeInvisibleOutlined />,
      key: 'hideOtherFeatures',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (opSeqId) {
          hideOtherFeatures(drawingId, opSeqId, menuInfo.interactionInfo.objectId)
        }
      },
    } as MenuElement

    const hideOtherSolidsEl = {
      label: 'Hide other solids',
      icon: <EyeInvisibleOutlined />,
      key: 'hideOtherSolids',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (menuInfo.interactionInfo.containerId) {
          hideOtherSolids(drawingId, menuInfo.interactionInfo.containerId)
        }
      },
    }

    const hideOtherInstancesEl = {
      label: 'Hide other instances',
      icon: <EyeInvisibleOutlined />,
      key: 'hideOtherInstances',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (menuInfo.interactionInfo.prodRefId) {
          hideOtherInstances(drawingId, menuInfo.interactionInfo.prodRefId)
        }
      },
    }

    const hideAllFeatures = {
      label: 'Hide all features',
      icon: <EyeInvisibleOutlined />,
      key: 'hideAllFeatures',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (opSeqId) {
          showOrHideAllFeatures(drawingId, opSeqId, false)
        }
      },
    }

    const hideAllSolidsEl = {
      label: 'Hide all solids',
      icon: <EyeInvisibleOutlined />,
      key: 'hideAllSolids',
      onClick: (menuInfo: CanvasMenuInfo) => {
        showOrHideAllSolids(drawingId, false)
      },
    }

    const hideAllInstancesEl = {
      label: 'Hide all instances',
      icon: <EyeInvisibleOutlined />,
      key: 'hideAllInstances',
      onClick: (menuInfo: CanvasMenuInfo) => {
        showOrHideAllInstances(drawingId, false)
      },
    }

    const showAllEl = {
      label: 'Show all',
      icon: <EyeOutlined />,
      key: 'showAll',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (isPartMode && opSeqId) {
          showAllFeaturesAndSolids(drawingId, opSeqId)
        } else {
          showOrHideAllInstances(drawingId, true)
        }
      },
    } as MenuElement

    const showMatesEl = {
      label: 'Show mates',
      icon: <EyeOutlined />,
      key: 'showMates',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (menuInfo.interactionInfo.prodRefId) {
          showOrHideMates(drawingId, menuInfo.interactionInfo.prodRefId, true)
        }
      },
    }

    const hideMatesEl = {
      label: 'Hide mates',
      icon: <EyeInvisibleOutlined />,
      key: 'hideMates',
      onClick: (menuInfo: CanvasMenuInfo) => {
        if (menuInfo.interactionInfo.prodRefId) {
          showOrHideMates(drawingId, menuInfo.interactionInfo.prodRefId, false)
        }
      },
    }

    // Deliberately NOT in MUTATING_MENU_KEYS: view-only guests may comment
    // (review is their job); the model-edit gate is unaffected.
    const addCommentEl = {
      label: 'Add comment',
      icon: <CommentOutlined />,
      key: 'addComment',
      onClick: (menuInfo: CanvasMenuInfo) => {
        // prodRefId is the instance in assembly mode; in part mode fall back
        // to the current product (the part the clicked solid belongs to).
        const targetId = menuInfo.interactionInfo.prodRefId || getDrawing(drawingId).structure.currentProduct
        if (targetId) {
          startAnnotationDraft(drawingId, targetId, menuInfo.clickInfo.clickPos)
        }
      },
    } as MenuElement

    const graphic = [
      isPartMode ? editAppearanceEl : null,
      isPartMode ? null : fixEl,
      isPartMode ? null : groupEl,
      { type: 'divider' },
      selectEl,
      { type: 'divider' },
      hideEl,
      isPartMode ? hideOtherSolidsEl : hideOtherInstancesEl,
      isPartMode ? hideAllSolidsEl : hideAllInstancesEl,
      showAllEl,
      isPartMode ? null : { type: 'divider' },
      isPartMode ? null : showMatesEl,
      isPartMode ? null : hideMatesEl,
      isPartMode ? null : { type: 'divider' },
      isPartMode
        ? null
        : {
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
      addCommentEl,
      { type: 'divider' },
      {
        label: 'Delete',
        icon: <DeleteOutlined />,
        key: 'delete',
        onClick: (menuInfo: CanvasMenuInfo) => {
          if (isPartMode) {
            deleteSolid(drawingId, menuInfo)
          } else {
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

    const sketch = [
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
    ] as MenuElement[]

    const sketchItem = [selectEl, { type: 'divider' }, ...sketch] as MenuElement[]

    const workGeometry = [
      selectEl,
      { type: 'divider' },
      hideEl,
      hideOtherFeaturesEl,
      hideAllFeatures,
      showAllEl,
      { type: 'divider' },
      zoomToFitEl,
    ] as MenuElement[]

    const descriptors: MenuDescriptor[] = [
      { objType: ScgGraphicType.POINT, ...grDescriptor },
      { objType: ScgGraphicType.CURVEPOINT, ...grDescriptor },
      { objType: ScgGraphicType.LINE, ...grDescriptor },
      { objType: ScgGraphicType.ARC, ...grDescriptor },
      { objType: ScgGraphicType.CIRCLE, ...grDescriptor },
      { objType: ScgGraphicType.NURBSCURVE, ...grDescriptor },
      {
        objType: ScgGraphicType.PLANE,
        ...grDescriptor,
        menuElements: [
          isPartMode
            ? {
                label: 'New Sketch',
                icon: <MenuItemIcon url={sketchURL} />,
                key: 'newSketch',
                onClick: (menuInfo: CanvasMenuInfo) => {
                  newSketch(drawingId, menuInfo)
                },
              }
            : null,
          isPartMode ? { type: 'divider' } : null,
          ...graphic,
        ],
      } as MenuDescriptor,
      { objType: ScgGraphicType.CYLINDER, ...grDescriptor },
      { objType: ScgGraphicType.CONE, ...grDescriptor },
      { objType: ScgGraphicType.SPHERE, ...grDescriptor },
      { objType: ScgGraphicType.NURBSSURFACE, ...grDescriptor },
      {
        objType: ScgClassType.CCPart,
        headerName: 'Part',
        headerIcon: <MenuHeaderIcon url={partURL} />,
        menuElements: [showAllEl, { type: 'divider' }, zoomToFitEl],
      },
      {
        objType: ScgClassType.CCAssembly,
        headerName: 'Assembly',
        headerIcon: <MenuHeaderIcon url={assemblyURL} />,
        menuElements: [showAllEl, { type: 'divider' }, zoomToFitEl],
      },
      {
        objType: ScgClassType.CCSketch,
        headerName: 'Sketch',
        headerIcon: <MenuHeaderIcon url={sketchURL} />,
        menuElements: sketch,
      },
      {
        objType: ScgClassType.CCPoint,
        headerName: 'Point',
        headerIcon: <MenuHeaderIcon url={sketchURL} />,
        menuElements: sketchItem,
      },
      {
        objType: ScgClassType.CCLine,
        headerName: 'Line',
        headerIcon: <MenuHeaderIcon url={sketchURL} />,
        menuElements: sketchItem,
      },
      {
        objType: ScgClassType.CCArc,
        headerName: 'Arc',
        headerIcon: <MenuHeaderIcon url={sketchURL} />,
        menuElements: sketchItem,
      },
      {
        objType: ScgClassType.CCCircle,
        headerName: 'Circle',
        headerIcon: <MenuHeaderIcon url={sketchURL} />,
        menuElements: sketchItem,
      },
      {
        objType: ScgClassType.CC2DConstraint,
        headerName: 'Constraint',
        headerIcon: <MenuHeaderIcon url={sketchURL} />,
        menuElements: sketchItem,
      },
      {
        objType: ScgClassType.CCWorkPoint,
        headerName: 'Workpoint',
        headerIcon: <MenuHeaderIcon url={workpointURL} />,
        menuElements: workGeometry,
      },
      {
        objType: ScgClassType.CCWorkAxis,
        headerName: 'Workaxis',
        headerIcon: <MenuHeaderIcon url={workaxisURL} />,
        menuElements: workGeometry,
      },
      {
        objType: ScgClassType.CCWorkPlane,
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
        objType: ScgClassType.CCWorkCSys,
        headerName: 'Workcsys',
        headerIcon: <MenuHeaderIcon url={workcsysURL} />,
        menuElements: workGeometry,
      },
      {
        objType: ScgClassType.CCWorkCoordSystem,
        headerName: 'Workcsys',
        headerIcon: <MenuHeaderIcon url={workcsysURL} />,
        menuElements: workGeometry,
      },
    ]

    if (!readOnly) {
      return descriptors
    }
    // View-only guest: keep the view items (select, hide/show, zoom, view-normal),
    // drop everything that mutates the model.
    return descriptors.map(d => ({ ...d, menuElements: stripMutatingItems(d.menuElements) }))
  }, [isPartMode, boundsControls, drawingId, opSeqId, camera, controls, readOnly])
}
