/* eslint-disable max-lines */
import * as THREE from 'three'

import { BuerliScope, DrawingID, getDrawing, GraphicID, GraphicType, ObjectID, PointMem, SelectorID } from '@buerli.io/core'
import { ccUtils, CCClasses } from '@buerli.io/classcad'
import { sketchIntersectionUtils } from '@buerli.io/react-cad'

type CommonInfo = { id: ObjectID }
type CommonBBObjInfo = { bb: THREE.Box2; aabb: AABBInfo }
type CommonGrObjInfo = { graphicId: GraphicID; containerId: ObjectID }
type AABBInfo = { min: THREE.Vector2; max: THREE.Vector2; points: THREE.Vector3[]; vec1: THREE.Vector3; vec2: THREE.Vector3 }
export type PointInfo = { pos: THREE.Vector3 } & CommonInfo
export type LineInfo = sketchIntersectionUtils.CCLineInfo & CommonInfo
export type ArcInfo = sketchIntersectionUtils.CCArcInfo & { startH: THREE.Vector3; endH: THREE.Vector3} & CommonInfo
export type CircleInfo = sketchIntersectionUtils.CCCircleInfo & { pos1H: THREE.Vector3; pos2H: THREE.Vector3 } & CommonInfo
export type SketchInfo = { points: PointInfo[]; lines: LineInfo[]; arcs: ArcInfo[]; circles: CircleInfo[]; sketchMatrixInv: THREE.Matrix4 }
export type GrObjInfo =  CommonBBObjInfo & CommonGrObjInfo
export type GrPointInfo = { pos: THREE.Vector3 } & CommonGrObjInfo
export type GrObjectsInfo = { bbObjects: GrObjInfo[]; points: GrPointInfo[] }
export type SolidInfo = CommonBBObjInfo & CommonInfo
export type InstanceInfo = SolidInfo
export type RigidsetInfo = { instancesInfo: InstanceInfo[] } & CommonInfo

export const convertToVector = (point: PointMem | undefined) => {
  return point ? new THREE.Vector3(point.value.x, point.value.y, point.value.z) : new THREE.Vector3()
}

const __cameraDir = new THREE.Vector3()
const __ray = new THREE.Ray()
const __plane = new THREE.Plane(new THREE.Vector3(0, 0, 1))

export const getPointOnPlane = (unprojectedPoint: THREE.Vector3, camera: THREE.Camera, globalToLocalM: THREE.Matrix4) => {
  camera.getWorldDirection(__cameraDir)
  __ray.set(unprojectedPoint, __cameraDir)
  __ray.applyMatrix4(globalToLocalM)
  const result = new THREE.Vector3()
  __ray.intersectPlane(__plane, result)
  __ray.direction.negate()
  __ray.intersectPlane(__plane, result)

  return result
}

export const getSketchGeomInfo = (drawingId: DrawingID, sketchId: ObjectID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const sketchDescendants = tree[sketchId]?.children || []
  const sketchMatrix = drawing.api.structure.calculateGlobalTransformation(sketchId)
  const sketchMatrixInv = sketchMatrix.clone().invert()

  const points: PointInfo[] = []
  const lines: LineInfo[] = []
  const arcs: ArcInfo[] = []
  const circles: CircleInfo[] = []
  sketchDescendants.forEach(id => {
    const sketchObj = tree[id]
    if (!sketchObj) {
      return
    }

    const objClass = tree[id]?.class

    if (ccUtils.base.isA(objClass, CCClasses.CCPoint)) {
      const pos = convertToVector(sketchObj.members?.pos as PointMem).applyMatrix4(sketchMatrix).project(camera).setZ(0.0)
      points.push({ id, pos })

      return
    }

    if (ccUtils.base.isA(objClass, CCClasses.CCLine)) {
      const points_ = sketchObj.children?.map(pointId => tree[pointId]) || []
      const [start, end] = points_
        .map(p => convertToVector(p.members?.pos as PointMem).applyMatrix4(sketchMatrix).project(camera).setZ(0.0))
      const dir = end.clone().sub(start)

      lines.push({ id, start, end, dir })

      return
    }

    if (ccUtils.base.isA(objClass, CCClasses.CCArc)) {
      const points_ = sketchObj.children?.map(pointId => tree[pointId]) || []
      const [start, end, center] = ['startPoint', 'endPoint', 'center'].map(name => {
        const point = points_.find(p => p.name === name)
        return convertToVector(point?.members?.pos as PointMem)
      })
      const [startH, endH] = [start, end].map(pos => {
        return pos.clone().applyMatrix4(sketchMatrix).project(camera).setZ(0.0)
      })

      const radius = sketchObj.members?.radius?.value as number
      const clockwise = (sketchObj.members?.bulge?.value as number) < 0

      let startAngle = Math.atan2(start.y - center.y, start.x - center.x)
      let endAngle = Math.atan2(end.y - center.y, end.x - center.x)
      startAngle = clockwise && startAngle < endAngle ? startAngle + 2 * Math.PI : startAngle
      endAngle = !clockwise && endAngle < startAngle ? endAngle + 2 * Math.PI : endAngle
      const angularLength = endAngle - startAngle

      arcs.push({ id, start, end, center, radius, clockwise, startAngle, endAngle, angularLength, startH, endH })

      return
    }

    if (ccUtils.base.isA(objClass, CCClasses.CCCircle)) {
      const radius = sketchObj.members?.radius?.value as number
      const center = tree[sketchObj.children?.[0] || -1]
      const centerL = convertToVector(center?.members?.pos as PointMem)
      const pos1H = centerL.clone().setX(centerL.x + radius)
      const pos2H = centerL.clone().setY(centerL.y + radius)
      ;[pos1H, pos2H].forEach(pos => pos.applyMatrix4(sketchMatrix).project(camera).setZ(0.0))
      circles.push({
        id,
        center: centerL,
        radius,
        pos1H,
        pos2H,
      })

      return
    }
  })

  return { points, lines, arcs, circles, sketchMatrixInv }
}

export const getAllSketchesGeomInfo = (drawingId: DrawingID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const curProduct = drawing.structure.currentProduct as ObjectID
  const tree = drawing.structure.tree
  const prodClass = tree[curProduct || -1]?.class || ''
  const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

  const sketchesInfo: SketchInfo[] = []

  if (!isPartMode) {
    return sketchesInfo
  }

  const sketchSetId = tree[curProduct].children?.find(id => ccUtils.base.isA(tree[id]?.class, CCClasses.CCSketchSet))
  const sketchSet = tree[sketchSetId || -1]
  if (!sketchSet) {
    return sketchesInfo
  }

  sketchSet.children?.forEach(sketchId => {
    const sketchGeomInfo = getSketchGeomInfo(drawingId, sketchId, camera)
    sketchesInfo.push(sketchGeomInfo)
  })

  return sketchesInfo
}

export const getVisibleSolids = (drawingId: DrawingID, productId?: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const curProduct = drawing.structure.currentProduct as ObjectID
  const tree = drawing.structure.tree
  const config = drawing.geometry.config.product

  const solidIds = tree[productId || curProduct]?.solids || []
  const visibleSolids: ObjectID[] = []
  solidIds.forEach(solidId => {
    const solid = drawing.geometry.cache[solidId]
    const isHidden = config[solidId]?.meshes?.hidden
    if (solid && !isHidden) {
      visibleSolids.push(solidId)
    }
  })

  return visibleSolids
}

const changeToBasis = (point: THREE.Vector3, vec1: THREE.Vector3, vec2: THREE.Vector3) => {
  let x: number, y: number
  if (Math.abs(vec1.x) < 1e-4) {
    y = point.x / vec2.x
    x = (point.y - y * vec2.y) / vec1.y
  } else {
    const k = vec1.y / vec1.x
    y = (point.y - point.x * k) / (vec2.y - vec2.x * k)
    x = (point.x - y * vec2.x) / vec1.x
  }

  return new THREE.Vector2(x, y)
}

const changeFromBasis = (point: THREE.Vector3, vec1: THREE.Vector3, vec2: THREE.Vector3) => {
  return vec1.clone().multiplyScalar(point.x).addScaledVector(vec2, point.y)
}

const projectBBPoints = (bb: THREE.Box3, camera: THREE.Camera, transform?: THREE.Matrix4) => {
  const bbPoints = [
    bb.min.clone(),
    bb.min.clone().setX(bb.max.x),
    bb.min.clone().setY(bb.max.y),
    bb.min.clone().setZ(bb.max.z),
    bb.max.clone().setX(bb.min.x),
    bb.max.clone().setY(bb.min.y),
    bb.max.clone().setZ(bb.min.z),
    bb.max.clone(),
  ]

  transform && bbPoints.forEach(p => p.applyMatrix4(transform))
  bbPoints.forEach(p => p.project(camera).setZ(0.0)) 

  return bbPoints
}


const getBB = (bbPointsH: THREE.Vector3[]) => {
  const xPoints = bbPointsH.map(bbPoint => bbPoint.x)
  const yPoints = bbPointsH.map(bbPoint => bbPoint.y)
  const min = new THREE.Vector2(Math.min(...xPoints), Math.min(...yPoints))
  const max = new THREE.Vector2(Math.max(...xPoints), Math.max(...yPoints))

  return new THREE.Box2(min, max)
}

const __bbDirs = Array(3).fill(0).map(() => new THREE.Vector3())
const __pointsAA = Array(4).fill(0).map(() => new THREE.Vector3())

// Assume the points in bbPointsH always have a fixed order:
// [(min, min, min), (max, min, min), (min, max, min), (min, min, max), (min, max, max), (max, min, max), (max, max, min), (max, max, max)]
const getAABB = (bbPointsH: THREE.Vector3[]) => {
  __bbDirs[0].copy(bbPointsH[1]).sub(bbPointsH[0])
  __bbDirs[1].copy(bbPointsH[2]).sub(bbPointsH[0])
  __bbDirs[2].copy(bbPointsH[3]).sub(bbPointsH[0])

  __bbDirs.sort((a, b) => b.lengthSq() - a.lengthSq())
  const vec1 = __bbDirs[0].clone().normalize()
  const vec2 = new THREE.Vector3(-vec1.y, vec1.x, 0.0)

  const bbPointsHAA = bbPointsH.map(bbPoint => changeToBasis(bbPoint, vec1, vec2))
  const xPoints = bbPointsHAA.map(bbPoint => bbPoint.x)
  const yPoints = bbPointsHAA.map(bbPoint => bbPoint.y)
  const min = new THREE.Vector2(Math.min(...xPoints), Math.min(...yPoints))
  const max = new THREE.Vector2(Math.max(...xPoints), Math.max(...yPoints))
  __pointsAA[0].set(min.x, min.y, 0.0)
  __pointsAA[1].set(max.x, min.y, 0.0)
  __pointsAA[2].set(min.x, max.y, 0.0)
  __pointsAA[3].set(max.x, max.y, 0.0)
  const points = __pointsAA.map(p => changeFromBasis(p, vec1, vec2))

  return { min, max, points, vec1, vec2 }
}

const __bb3 = new THREE.Box3()

export const getSolidsInfo = (drawingId: DrawingID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const selector = drawing.selection.refs[drawing.selection.active || -1]
  if (selector && !selector.isSelectable(BuerliScope, GraphicType.BREP)) {
    return []
  }

  const solidIds = getVisibleSolids(drawingId)
  const solidsInfo = solidIds.map(id => {
    // getVisibleSolids should only return ids with existing cache records, so no checks are needed here
    const solid = drawing.geometry.cache[id]
    __bb3.set(solid.box.min, solid.box.max)
    const bbPointsH = projectBBPoints(__bb3, camera)
    const bb = getBB(bbPointsH)
    const aabb = getAABB(bbPointsH)

    return { id, bb, aabb } as SolidInfo
  })

  return solidsInfo
}

const getVisibleInstances = (drawingId: DrawingID) => {
  const drawing = getDrawing(drawingId)
  const curInstance = drawing.structure.currentInstance
  const tree = drawing.structure.tree
  const config = drawing.geometry.config.product

  const descendants = ccUtils.base.getDescendants(drawingId, curInstance || -1)
  const instanceIds = descendants.filter(id => {
    const productId = tree[id]?.members?.productId?.value as ObjectID
    const isHidden = config[id]?.meshes?.hidden
    return !isHidden && ccUtils.base.isA(tree[id]?.class, CCClasses.IProductReference) && ccUtils.base.isA(tree[productId]?.class, CCClasses.CCPart)
  })

  return instanceIds
}

const __bbSolid = new THREE.Box3()

export const getInstancesInfo = (drawingId: DrawingID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const instanceIds = getVisibleInstances(drawingId)
  const instancesInfo = instanceIds.map(id => {
    // I don't use drawing.api.structure.calculateProductBounds here because the resulting bounding boxes are bigger (which would lead to less accurate selections)
    // That's because the instance transforms in it are applied before the union operation
    const transform = drawing.api.structure.calculateGlobalTransformation(id)
    const productId = tree[id]?.members?.productId?.value as ObjectID
    const solidIds = getVisibleSolids(drawingId, productId)

    __bb3.makeEmpty()
    solidIds.forEach(solidId => {
      // getVisibleSolids should only return ids with existing cache records, so no checks are needed here
      const solid = drawing.geometry.cache[solidId]
      __bbSolid.set(solid.box.min, solid.box.max)
      __bb3.union(__bbSolid)
    })

    const bbPointsH = projectBBPoints(__bb3, camera, transform)
    const bb = getBB(bbPointsH)
    const aabb = getAABB(bbPointsH)

    return { id, bb, aabb } as InstanceInfo
  })

  return instancesInfo
}

export const getRigidsetsInfo = (drawingId: DrawingID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const curProduct = drawing.structure.currentProduct
  const tree = drawing.structure.tree
  const rigidsetIds = tree[curProduct || -1]?.instances || []

  const rigidsetsInfo = rigidsetIds.map(id => ({ id, instancesInfo: [] as InstanceInfo[] }))

  const instancesInfo = getInstancesInfo(drawingId, camera)
  instancesInfo.forEach(instanceInfo => {
    const instanceId = ccUtils.assembly.getMatePath(drawingId, instanceInfo.id).pop() || -1
    const rigidsetInfo = rigidsetsInfo.find(rsInfo => rsInfo.id === instanceId)
    if (!rigidsetInfo) {
      return
    }
    
    rigidsetInfo.instancesInfo.push(instanceInfo)
  })

  return rigidsetsInfo as RigidsetInfo[]
}

const __bb00 = new THREE.Vector3()
const __bb01 = new THREE.Vector3()
const __bb10 = new THREE.Vector3()
const __bb11 = new THREE.Vector3()
const __dir = new THREE.Vector3()

const bb2ToV3 = (bb: THREE.Box2) => {
  __bb00.set(bb.min.x, bb.min.y, 0.0)
  __bb01.set(bb.max.x, bb.min.y, 0.0)
  __bb10.set(bb.min.x, bb.max.y, 0.0)
  __bb11.set(bb.max.x, bb.max.y, 0.0)
}

const intersectsLine = (lineStart: THREE.Vector3, lineEnd: THREE.Vector3, lineInfo: LineInfo) => {
  __dir.copy(lineEnd).sub(lineStart)
  const intersections = sketchIntersectionUtils.intersectLineLine({ start: lineStart, end: lineEnd, dir: __dir }, lineInfo)

  return intersections[1].length > 0
}

const intersectsArc = (lineStart: THREE.Vector3, lineEnd: THREE.Vector3, arcInfo: ArcInfo) => {
  __dir.copy(lineEnd).sub(lineStart)
  const intersections = sketchIntersectionUtils.intersectLineArc({ start: lineStart, end: lineEnd, dir: __dir }, arcInfo)

  return intersections[1].length > 0
}

const intersectsCircle = (lineStart: THREE.Vector3, lineEnd: THREE.Vector3, circleInfo: CircleInfo) => {
  __dir.copy(lineEnd).sub(lineStart)
  const intersections = sketchIntersectionUtils.intersectLineCircle({ start: lineStart, end: lineEnd, dir: __dir }, circleInfo)

  return intersections[1].length > 0
}

export const containsPoint = (bb: THREE.Box2, pos: THREE.Vector3) => {
  const { min, max } = bb

  return pos.x >= min.x && pos.x <= max.x && pos.y >= min.y && pos.y <= max.y
}

export const containsSketchLine = (bb: THREE.Box2, lineInfo: LineInfo) => {
  const { min, max } = bb
  const { start: sp, end: ep } = lineInfo

  return (sp.x >= min.x && sp.x <= max.x && sp.y >= min.y && sp.y <= max.y) &&
    (ep.x >= min.x && ep.x <= max.x && ep.y >= min.y && ep.y <= max.y)
}

export const touchesSketchLine = (bb: THREE.Box2, lineInfo: LineInfo) => {
  const { min, max } = bb
  const { start: sp, end: ep } = lineInfo
  bb2ToV3(bb)

  return (sp.x >= min.x && sp.x <= max.x && sp.y >= min.y && sp.y <= max.y) ||
    (ep.x >= min.x && ep.x <= max.x && ep.y >= min.y && ep.y <= max.y) ||
    intersectsLine(__bb00, __bb01, lineInfo) ||
    intersectsLine(__bb00, __bb10, lineInfo) ||
    intersectsLine(__bb01, __bb11, lineInfo) ||
    intersectsLine(__bb10, __bb11, lineInfo)
}

export const containsSketchArc = (bb: THREE.Box2, arcInfo: ArcInfo, bbPointsL: THREE.Vector3[]) => {
  const { min, max } = bb
  const { startH: spH, endH: epH } = arcInfo

  // TODO: Not entirely sure if situations when both points are exactly touched without arc intersections are possible
  // If it ever emerges, also calculate a midpoint here and check if it is within the rectangle
  return (spH.x >= min.x && spH.x <= max.x && spH.y >= min.y && spH.y <= max.y) &&
    (epH.x >= min.x && epH.x <= max.x && epH.y >= min.y && epH.y <= max.y) &&
    !intersectsArc(bbPointsL[0], bbPointsL[1], arcInfo) &&
    !intersectsArc(bbPointsL[0], bbPointsL[2], arcInfo) &&
    !intersectsArc(bbPointsL[1], bbPointsL[3], arcInfo) &&
    !intersectsArc(bbPointsL[2], bbPointsL[3], arcInfo)
}

export const touchesSketchArc = (bb: THREE.Box2, arcInfo: ArcInfo, bbPointsL: THREE.Vector3[]) => {
  const { min, max } = bb
  const { startH: spH, endH: epH } = arcInfo

  return (spH.x >= min.x && spH.x <= max.x && spH.y >= min.y && spH.y <= max.y) ||
    (epH.x >= min.x && epH.x <= max.x && epH.y >= min.y && epH.y <= max.y) ||
    intersectsArc(bbPointsL[0], bbPointsL[1], arcInfo) ||
    intersectsArc(bbPointsL[0], bbPointsL[2], arcInfo) ||
    intersectsArc(bbPointsL[1], bbPointsL[3], arcInfo) ||
    intersectsArc(bbPointsL[2], bbPointsL[3], arcInfo)
}

export const containsSketchCircle = (bb: THREE.Box2, circleInfo: CircleInfo, bbPointsL: THREE.Vector3[]) => {
  const { min, max } = bb
  const { pos1H: p1H, pos2H: p2H } = circleInfo

  return (p1H.x >= min.x && p1H.x <= max.x && p1H.y >= min.y && p1H.y <= max.y) &&
    (p2H.x >= min.x && p2H.x <= max.x && p2H.y >= min.y && p2H.y <= max.y) &&
    !intersectsCircle(bbPointsL[0], bbPointsL[1], circleInfo) &&
    !intersectsCircle(bbPointsL[0], bbPointsL[2], circleInfo) &&
    !intersectsCircle(bbPointsL[1], bbPointsL[3], circleInfo) &&
    !intersectsCircle(bbPointsL[2], bbPointsL[3], circleInfo)
}

export const touchesSketchCircle = (bb: THREE.Box2, circleInfo: CircleInfo, bbPointsL: THREE.Vector3[]) => {
  const { min, max } = bb
  const { pos1H: p1H } = circleInfo

  return (p1H.x >= min.x && p1H.x <= max.x && p1H.y >= min.y && p1H.y <= max.y) ||
    intersectsCircle(bbPointsL[0], bbPointsL[1], circleInfo) ||
    intersectsCircle(bbPointsL[0], bbPointsL[2], circleInfo) ||
    intersectsCircle(bbPointsL[1], bbPointsL[3], circleInfo) ||
    intersectsCircle(bbPointsL[2], bbPointsL[3], circleInfo)
}

export const containsBB = (bbRect: THREE.Box2, bbObj: THREE.Box2) => {
  return bbRect.containsBox(bbObj)
}

const __dir1 = new THREE.Vector3()
const __dir2 = new THREE.Vector3()

export const touchesBB = (bbRect: THREE.Box2, bbObj: THREE.Box2, aabb: AABBInfo) => {
  if (!bbRect.intersectsBox(bbObj)) {
    return false
  }

  const { min, max } = bbRect
  const [p00H, p01H, p10H, p11H] = aabb.points

  if (
    (p00H.x >= min.x && p00H.x <= max.x && p00H.y >= min.y && p00H.y <= max.y) ||
    (p01H.x >= min.x && p01H.x <= max.x && p01H.y >= min.y && p01H.y <= max.y) ||
    (p10H.x >= min.x && p10H.x <= max.x && p10H.y >= min.y && p10H.y <= max.y) ||
    (p11H.x >= min.x && p11H.x <= max.x && p11H.y >= min.y && p11H.y <= max.y)
  ) {
    return true
  }

  bb2ToV3(bbRect)

  const [p00AA, p01AA, p10AA, p11AA] = [__bb00, __bb01, __bb10, __bb11].map(p => changeToBasis(p, aabb.vec1, aabb.vec2))
  if (
    (p00AA.x >= aabb.min.x && p00AA.x <= aabb.max.x && p00AA.y >= aabb.min.y && p00AA.y <= aabb.max.y) ||
    (p01AA.x >= aabb.min.x && p01AA.x <= aabb.max.x && p01AA.y >= aabb.min.y && p01AA.y <= aabb.max.y) ||
    (p10AA.x >= aabb.min.x && p10AA.x <= aabb.max.x && p10AA.y >= aabb.min.y && p10AA.y <= aabb.max.y) ||
    (p11AA.x >= aabb.min.x && p11AA.x <= aabb.max.x && p11AA.y >= aabb.min.y && p11AA.y <= aabb.max.y)
  ) {
    return true
  }

  __dir1.copy(p01H).sub(p00H)
  __dir2.copy(p10H).sub(p00H)

  const bbLine1 = { start: p00H, end: p01H, dir: __dir1, id: -1 }
  const bbLine2 = { start: p00H, end: p10H, dir: __dir2, id: -1 }
  const bbLine3 = { start: p01H, end: p11H, dir: __dir2, id: -1 }
  const bbLine4 = { start: p10H, end: p11H, dir: __dir1, id: -1 }

  return intersectsLine(__bb00, __bb01, bbLine1) ||
    intersectsLine(__bb00, __bb01, bbLine2) ||
    intersectsLine(__bb00, __bb01, bbLine3) ||
    intersectsLine(__bb00, __bb01, bbLine4) ||
    intersectsLine(__bb00, __bb10, bbLine1) ||
    intersectsLine(__bb00, __bb10, bbLine2) ||
    intersectsLine(__bb00, __bb10, bbLine3) ||
    intersectsLine(__bb00, __bb10, bbLine4) ||
    intersectsLine(__bb01, __bb11, bbLine1) ||
    intersectsLine(__bb01, __bb11, bbLine2) ||
    intersectsLine(__bb01, __bb11, bbLine3) ||
    intersectsLine(__bb01, __bb11, bbLine4) ||
    intersectsLine(__bb10, __bb11, bbLine1) ||
    intersectsLine(__bb10, __bb11, bbLine2) ||
    intersectsLine(__bb10, __bb11, bbLine3) ||
    intersectsLine(__bb10, __bb11, bbLine4)
}

export const getSelectableGrObjects = (drawingId: DrawingID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const curProduct = drawing.structure.currentProduct
  const selector = drawing.selection.refs[drawing.selection.active || -1]
  if (selector.maxLen > 0) {
    // If there is a selection limit for the current selector, don't allow rect-selection at all
    return { bbObjects: [], points: [] }
  }

  const solidIds = getVisibleSolids(drawingId, curProduct)
  const bbObjects: GrObjInfo[] = []
  const points: GrPointInfo[] = []
  solidIds.forEach(solidId => {
    const solid = drawing.geometry.cache[solidId]

    Object.values(solid.map).forEach(geom => {
      if (!selector.isSelectable(BuerliScope, geom.type)) {
        return
      }

      const geometry = geom.geometry as THREE.BufferGeometry
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox()
      }

      const bbPointsH = projectBBPoints(geometry.boundingBox as THREE.Box3, camera)
      const bb = getBB(bbPointsH)
      const aabb = getAABB(bbPointsH)

      bbObjects.push({ graphicId: geom.graphicId, containerId: geom.container.id, bb, aabb })
    })

    if (!selector.isSelectable(BuerliScope, 'point')) {
      return 
    }

    solid.points.forEach(point => {
      const pos = point.geometry.clone().project(camera).setZ(0.0)
      points.push({ graphicId: point.graphicId, containerId: point.container.id, pos })
    })
  })

  return { bbObjects, points }
}

// TODO: Use somethin like a quadtree to optimize the rectangle-selection! It's naive implementation didn't improve the performance much, so it has to be made suited better for rectangle-selection... 

export const attemptSketchesGeomSelection = (
  sketchesInfo: SketchInfo[],
  bbRect: THREE.Box2,
  onlyEntireBB: boolean,
  camera: THREE.Camera,
  onSelectCB: (id: ObjectID) => void
) => {
  sketchesInfo.forEach(sketchInfo => {
    const bbPointsL = [
      getPointOnPlane(new THREE.Vector3(bbRect.min.x, bbRect.min.y, 0.0).unproject(camera), camera, sketchInfo.sketchMatrixInv),
      getPointOnPlane(new THREE.Vector3(bbRect.max.x, bbRect.min.y, 0.0).unproject(camera), camera, sketchInfo.sketchMatrixInv),
      getPointOnPlane(new THREE.Vector3(bbRect.min.x, bbRect.max.y, 0.0).unproject(camera), camera, sketchInfo.sketchMatrixInv),
      getPointOnPlane(new THREE.Vector3(bbRect.max.x, bbRect.max.y, 0.0).unproject(camera), camera, sketchInfo.sketchMatrixInv),
    ]
  
    sketchInfo.points.forEach(pointInfo => {
      if (containsPoint(bbRect, pointInfo.pos)) {
        onSelectCB(pointInfo.id)
      }
    })
  
    sketchInfo.lines.forEach(lineInfo => {
      if (onlyEntireBB && containsSketchLine(bbRect, lineInfo) || !onlyEntireBB && touchesSketchLine(bbRect, lineInfo)) {
        onSelectCB(lineInfo.id)
      }
    })
  
    sketchInfo.arcs.forEach(arcInfo => {
      if (
        onlyEntireBB && containsSketchArc(bbRect, arcInfo, bbPointsL) ||
        !onlyEntireBB && touchesSketchArc(bbRect, arcInfo, bbPointsL)
      ) {
        onSelectCB(arcInfo.id)
      }
    })
  
    sketchInfo.circles.forEach(circleInfo => {
      if (
        onlyEntireBB && containsSketchCircle(bbRect, circleInfo, bbPointsL) ||
        !onlyEntireBB && touchesSketchCircle(bbRect, circleInfo, bbPointsL)
      ) {
        onSelectCB(circleInfo.id)
      }
    })
  })
}

export const attemptGrObjectsSelection = (
  grObjectsInfo: GrObjInfo[],
  bbRect: THREE.Box2,
  onlyEntireBB: boolean,
  onSelectCB: (graphicId: GraphicID, containerId: ObjectID) => void
) => {
  grObjectsInfo.forEach(({ graphicId, containerId, bb, aabb }) => {
    if (onlyEntireBB && containsBB(bbRect, bb) || !onlyEntireBB && touchesBB(bbRect, bb, aabb)) {
      onSelectCB(graphicId, containerId)
    }
  })
}

export const attemptGrPointsSelection = (
  grPointsInfo: GrPointInfo[],
  bbRect: THREE.Box2,
  onSelectCB: (graphicId: GraphicID, containerId: ObjectID) => void
) => {
  grPointsInfo.forEach(({ graphicId, containerId, pos }) => {
    if (containsPoint(bbRect, pos)) {
      onSelectCB(graphicId, containerId)
    }
  })
}

export const attemptBBObjectsSelection = (
  bbObjectsInfo: SolidInfo[] | InstanceInfo[],
  bbRect: THREE.Box2,
  onlyEntireBB: boolean,
  onSelectCB: (id: ObjectID) => void
) => {
  bbObjectsInfo.forEach(({ id, bb, aabb }) => {
    if (onlyEntireBB && containsBB(bbRect, bb) || !onlyEntireBB && touchesBB(bbRect, bb, aabb)) {
      onSelectCB(id)
    }
  })
}

export const attemptRigidsetsSelection = (
  rigidsetsInfo: RigidsetInfo[],
  bbRect: THREE.Box2,
  onlyEntireBB: boolean,
  onSelectCB: (id: ObjectID) => void
) => {
  rigidsetsInfo.forEach(rigidsetInfo => {
    if (onlyEntireBB) {
      if (rigidsetInfo.instancesInfo.every(({ bb }) => containsBB(bbRect, bb))) {
        onSelectCB(rigidsetInfo.id)
      }
  
      return
    }
  
    if (rigidsetInfo.instancesInfo.some(({ bb, aabb }) => touchesBB(bbRect, bb, aabb))) {
      onSelectCB(rigidsetInfo.id)
    }
  })
}

const selectorIgnoreList = [/useGeometry/, /useReference/, /RefChange\d+/]

export const isSelectorValid = (selId: SelectorID) => {
  return !selectorIgnoreList.some(ignoreExpr => ignoreExpr.test(selId.toString()))
}
