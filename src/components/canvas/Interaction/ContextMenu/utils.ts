import * as THREE from 'three'

import { CCClasses } from '@buerli.io/classcad'
import { DrawingID, getDrawing, LineGeometry, EdgeGeometry, ArcGeometry, InteractionInfo, ObjectID } from '@buerli.io/core'

import { MenuObjType } from './types'
import { getAdjacentMeshNormal } from '../../Gizmo/utils'

const isPoint = (intersection: THREE.Intersection) => Boolean(intersection.object?.userData?.pointMap)
const isLine = (intersection: THREE.Intersection) => Boolean(intersection.object?.userData?.lineMap)

export const findSuitableIntersection = (intersections: THREE.Intersection[], lineThreshold: number, pointThreshold: number) => {
  let index = intersections.findIndex(i => i.object.userData?.objId || i.object.userData?.isBuerliGeometry)
  let intersection = intersections[index]
  if (!intersection) {
    return undefined
  }

  if (intersection.object.userData.objId) {
    return intersection
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
