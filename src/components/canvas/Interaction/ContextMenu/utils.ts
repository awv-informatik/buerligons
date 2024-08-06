import * as THREE from 'three'

import { CCClasses, ccUtils } from '@buerli.io/classcad'
import {
  DrawingID,
  getDrawing,
  LineGeometry,
  EdgeGeometry,
  ArcGeometry,
  InteractionInfo,
  ObjectID,
  GeometryElement,
  createInfo,
  IStructureObject,
  BuerliScope,
  GraphicType,
  MeshTypes,
} from '@buerli.io/core'

import { MenuObjType } from './types'
import { getAdjacentMeshNormal } from '../../Gizmo/utils'
import { getBuerliGeometry, isBLine, isBPoint, isSketchActive } from '../utils'
import { TreeObjScope } from '@buerli.io/react-cad'


export const isSketchGeometry = (arg: IStructureObject | CCClasses) => {
  if (arg === undefined) {
    return false
  }

  const objClass = typeof arg === 'string' ? arg : arg.class
  // Not sure if CC_Curve might be found outside sketch. So classes are compared directly here.
  return (
    ccUtils.base.isA(objClass, CCClasses.CCPoint) ||
    ccUtils.base.isA(objClass, CCClasses.CCLine) ||
    ccUtils.base.isA(objClass, CCClasses.CCArc) ||
    ccUtils.base.isA(objClass, CCClasses.CCCircle)
  )
}

export const is2DConstraint = (arg: IStructureObject | CCClasses) => {
  if (arg === undefined) {
    return false
  }

  const objClass = typeof arg === 'string' ? arg : arg.class
  return Boolean(objClass.match(/CC_2D.+Constraint/)) || ccUtils.base.isA(objClass, CCClasses.CCRigidSet)
}

export const isSketchRegion = (arg: IStructureObject | CCClasses) => {
  if (arg === undefined) {
    return false
  }

  const objClass = typeof arg === 'string' ? arg : arg.class
  return ccUtils.base.isA(objClass, CCClasses.CCSketchRegion)
}

export const isSketchObj = (obj: IStructureObject) => {
  return ccUtils.base.isA(obj?.class, CCClasses.CCSketch) || isSketchGeometry(obj) || is2DConstraint(obj)
}

const getSketchPriority = (object: IStructureObject) => {
  if (ccUtils.base.isA(object.class, CCClasses.CCLine)) {
    return 1
  }
  if (ccUtils.base.isA(object.class, CCClasses.CCArc)) {
    return 2
  }
  if (ccUtils.base.isA(object.class, CCClasses.CCCircle)) {
    return 3
  }
  if (is2DConstraint(object) || isSketchRegion(object)) {
    return 4
  }
  if (ccUtils.base.isA(object.class, CCClasses.CCPoint)) {
    return 5
  }

  return -1
}

const getSketchId = (drawingId: DrawingID, objId: ObjectID | undefined) => {
  const tree = getDrawing(drawingId).structure.tree
  const obj = tree[objId || -1]
  if (ccUtils.base.isA(obj?.class, CCClasses.CCSketch)) {
    return objId as ObjectID
  }

  return objId && isSketchObj(obj) && getAncestorIdByClass(drawingId, objId, CCClasses.CCSketch) || -1
}

export const getSuitableIntersections = (intersections: THREE.Intersection[], drawingId: DrawingID) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree
  const isSelActive = drawing.selection.active !== null
  let suitableIntersections = intersections.filter(i => i.object.userData?.objId || i.object.userData?.isBuerliGeometry)

  if (isSelActive) {
    // If selection is active, filter out unselectable items
    const selection = drawing.selection.refs[drawing.selection.active]
    suitableIntersections = suitableIntersections.filter(i => {
      const objId = i.object.userData?.objId as ObjectID | undefined
      const object = tree[objId || -1]
      if (object) {
        return selection.isSelectable(TreeObjScope, { object })
      }

      const uData = i.object.userData
      if (!uData) {
        return false
      }

      const productId = uData.productId || -1
      const instanceId = ccUtils.assembly.getMatePath(drawingId, productId).pop() || -1
      const instance = tree[instanceId]
      const isInstanceSelectable = instance ? selection.isSelectable(TreeObjScope, { object: instance }) : false

      const index = i.index ?? -1
      const faceIndex = i.faceIndex ?? -1
      const geom: GeometryElement | undefined = uData.pointMap?.[index] || uData.lineMap?.[index] || uData.meshMap?.[faceIndex]
      if (!geom) {
        return false
      }

      const isSolidSelectable = selection.isSelectable(BuerliScope, geom.container.type)
      const isLoopSelectable = selection.isSelectable(BuerliScope, GraphicType.LOOP) && MeshTypes.indexOf(geom.type) >= 0
      const isGrSelectable = selection.isSelectable(BuerliScope, geom.type)

      return isInstanceSelectable || isSolidSelectable || isLoopSelectable || isGrSelectable
    })
  }
  else {
    const isSketchActive_ = isSketchActive(drawingId)
    const sketchId = isSketchActive_ ? drawing.plugin.refs[drawing.plugin.active.feature || -1].objectId as ObjectID : undefined
    suitableIntersections = suitableIntersections.filter(i => {
      const objId = i.object.userData?.objId as ObjectID | undefined
      if (!objId || !isSketchObj(tree[objId])) {
        return true
      }
  
      return isSketchActive_ ? getSketchId(drawingId, objId) === sketchId : false
    })
  }


  const sketchDistMap: { [key: ObjectID]: number} = {}
  suitableIntersections.forEach(i => {
    const objId = i.object.userData?.objId as ObjectID | undefined
    if (objId && isSketchObj(tree[objId])) {
      const sketchId = getSketchId(drawingId, objId)
      if (sketchId && !sketchDistMap[sketchId]) {
        sketchDistMap[sketchId] = i.distance
      }
    }
  })

  return suitableIntersections.sort((i1, i2) => {
    const obj1Id = i1.object.userData?.objId as ObjectID | undefined
    const obj2Id = i2.object.userData?.objId as ObjectID | undefined
    const sketch1Id = getSketchId(drawingId, obj1Id)
    const sketch2Id = getSketchId(drawingId, obj2Id)
    const dist1 = sketchDistMap[sketch1Id] || i1.distance
    const dist2 = sketchDistMap[sketch2Id] || i2.distance
    if (obj1Id && obj2Id && sketch1Id && sketch2Id && sketch1Id === sketch2Id) {
      // If both objects belong to the same sketch, sort them sketch-wise
      return getSketchPriority(tree[obj2Id]) - getSketchPriority(tree[obj1Id]) || obj1Id - obj2Id
    }
    // Otherwise, sort regularly
    return dist1 - dist2
  })
}

export const getFirstIntersection = (intersections: THREE.Intersection[], drawingId: DrawingID, lineThreshold: number, pointThreshold: number) => {
  if (intersections.length === 0) {
    return undefined
  }

  let index = 0
  let intersection = intersections[index]
  if (intersection.object.userData.objId) {
    return intersection
  }
  
  const minDist = intersection.distance
  const maxThreshold = Math.max(lineThreshold, pointThreshold)
  
  while (intersections[index] && intersections[index].distance - minDist < maxThreshold) {
    const intersectionNext = intersections[index]
    if (isBPoint(intersectionNext) && intersectionNext.distance - minDist < pointThreshold) {
      // If we find a point within point threshold, just return it
      return intersectionNext
    }
    if (!isBLine(intersection) && isBLine(intersectionNext) && intersectionNext.distance - minDist < lineThreshold) {
      intersection = intersectionNext
    }
    index++
  }

  return intersection
}

export const getUniqueSelIntersections = (intersections: THREE.Intersection[], drawingId: DrawingID) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree
  const selection = drawing.selection.refs[drawing.selection.active || -1]
  if (!selection) {
    return intersections
  }

  const ids: string[] = []
  const processId = (newId: string) => {
    if (ids.indexOf(newId) === -1) {
      ids.push(newId)
      return true
    }
    else {
      return false
    }
  }

  return intersections.filter(i => {
    const uData = i.object.userData
    if (uData.objId) {
      // If there is an objId, assume it is selectable because unselectable intersections should have been filtered already
      return processId(uData.objId.toString() as string)
    }

    const productId = uData.productId
    const instanceId = ccUtils.assembly.getMatePath(drawingId, productId).pop() || -1
    const instance = tree[instanceId]
    if (instance && selection.isSelectable(TreeObjScope, { object: instance })) {
      return processId(instanceId.toString())
    }

    const geom = getBuerliGeometry(i)
    if (!geom) {
      return false
    }

    if (selection.isSelectable(BuerliScope, geom.container.type)) {
      return processId(`${productId}|${geom.container.id}`)
    } else if (selection.isSelectable(BuerliScope, GraphicType.LOOP) && MeshTypes.indexOf(geom.type) >= 0 || selection.isSelectable(BuerliScope, geom.type)) {
      // Assume there can't be multiple intersections that would point to exact same loop or BuerliGeometry, so just return true
      return true
    }
    
    return false
  })
}

export const getInteractionInfo = (drawingId: DrawingID, intersection: THREE.Intersection) => {
  const drawing = getDrawing(drawingId)
  const uData = intersection.object?.userData
  if (uData?.objId) {
    const curProdId = drawing.structure.currentProduct || -1
    const object = drawing.structure.tree[uData.objId]
    return object ? createInfo({ objectId: object.id, prodRefId: curProdId }) : undefined
  }
  else if (uData?.isBuerliGeometry) {
    const index = intersection.index ?? -1
    const faceIndex = intersection.faceIndex ?? -1
    const object: GeometryElement | undefined = uData?.pointMap?.[index] || uData?.lineMap?.[index] || uData?.meshMap?.[faceIndex]
    return object ? createInfo({
      objectId: object.container.ownerId,
      graphicId: object.graphicId,
      containerId: object.container.id,
      prodRefId: uData.productId,
    }) : undefined
  }

  return undefined
}

const getEdgeNormal = (drawingId: DrawingID, edge: LineGeometry | EdgeGeometry | ArcGeometry, intersection: THREE.Intersection, clickPos: THREE.Vector3) => {
  if (edge.type === 'arc' || edge.type === 'circle') {
    return (edge as ArcGeometry).normal.clone().normalize()
  }
  else {
    return getAdjacentMeshNormal(drawingId, edge.graphicId, intersection, clickPos)
  }
}

export const getGeometryNormal = (drawingId: DrawingID, intersection: THREE.Intersection, cameraRay: THREE.Ray) => {
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
      const solid = drawing.geometry.cache[point.container.id]
      const line = solid.map[point.owners[0]?.ownerId] as LineGeometry | EdgeGeometry | ArcGeometry
      if (line) {
        normal = getEdgeNormal(drawingId, line, intersection, pos)
      }
    }
  } else if (typeof intersection.index === 'number' && object.userData.lineMap) {
    // Line
    const line = object.userData.lineMap[intersection.index || 0]
    if (line) {
      normal = getEdgeNormal(drawingId, line, intersection, pos)
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

export const getObjType = (drawingId: DrawingID, interactionInfo: InteractionInfo): MenuObjType => {
  const drawing = getDrawing(drawingId)

  if (interactionInfo.containerId && interactionInfo.graphicId) {
    const solid = drawing.geometry.cache[interactionInfo.containerId]
    const grType =
      solid.map[interactionInfo.graphicId]?.type ||
      solid.points.find(point => point.graphicId === interactionInfo?.graphicId)?.type

    return grType
  }
  
  const obj = drawing.structure.tree[interactionInfo.objectId]
  return obj.class as CCClasses
}

// TODO: Copypasted from buerli-react-cad helpers. Resolve the duplication somehow...
export function getAncestorIdByClass(drawingId: DrawingID, objectId: ObjectID, parentClass: CCClasses) {
  const tree = getDrawing(drawingId).structure.tree
  let object = tree[objectId] as IStructureObject
  while (object.parent !== null && tree[object.parent].class !== parentClass) {
    object = tree[object.parent] as IStructureObject
  }

  return object.parent
}

export const getAncestors = (drawingId: DrawingID, objectId: ObjectID) => {
  const tree = getDrawing(drawingId).structure.tree

  let curId: ObjectID = objectId
  const ancestors: ObjectID[] = []
  while (Boolean(curId) && tree[curId]) {
    ancestors.push(tree[curId].parent as ObjectID)
    curId = tree[curId].parent as ObjectID
  }

  return ancestors
}

export function getDescendants(drawingId: DrawingID, objectId: ObjectID) {
  const object = getDrawing(drawingId).structure.tree[objectId]
  const descendants: ObjectID[] = []
  object?.children &&
    object.children.forEach(child => {
      descendants.push(child, ...getDescendants(drawingId, child))
    })
  return descendants
}

export function getSelectedInstances(drawingId: DrawingID, instanceId: ObjectID) {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const selectedInfo = drawing.interaction.selected || []
  const instanceIds = selectedInfo
    .filter(info => {
      const objClass = tree[info.prodRefId || -1]?.class
      return ccUtils.base.isA(objClass, CCClasses.IProductReference)
    })
    .map(info => info.prodRefId as ObjectID)
  if (instanceIds.indexOf(instanceId) === -1) {
    instanceIds.push(instanceId)
  }

  return instanceIds
}

export function getSelectedSolids(drawingId: DrawingID, solidId: ObjectID, returnTreeObjIds: boolean) {
  const drawing = getDrawing(drawingId)
  const curProdId = drawing.structure.currentProduct as ObjectID
  const solidOwner = drawing.graphic.containers[solidId]?.owner
  
  const selectedInfo = drawing.interaction.selected || []
  const curSolids = drawing.structure.tree[curProdId]?.solids || []
  const solidIds = selectedInfo
    .filter(info => info.containerId && curSolids.indexOf(info.containerId) !== -1)
    .map(info => returnTreeObjIds ? info.objectId : info.containerId as ObjectID)
  if (solidIds.indexOf(returnTreeObjIds ? solidOwner : solidId) === -1 && curSolids.indexOf(solidId) !== -1) {
    solidIds.push(returnTreeObjIds ? solidOwner : solidId)
  }

  return solidIds
}

export function getWCSystems(drawingId: DrawingID, productId: ObjectID) {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const prodChildren = tree[productId]?.children || []
  const geomSetId = prodChildren.find(id => ccUtils.base.isA(tree[id]?.class, CCClasses.CCGeometrySet))
  const geomSetChildren = tree[geomSetId || -1]?.children || []
  return geomSetChildren.filter(
    id => ccUtils.base.isA(tree[id].class, CCClasses.CCWorkCSys) || ccUtils.base.isA(tree[id].class, CCClasses.CCWorkCoordSystem)
  )
}
