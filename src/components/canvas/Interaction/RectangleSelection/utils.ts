import * as THREE from 'three'

import { DrawingID, getDrawing, ObjectID, PointMem } from '@buerli.io/core'
import { ccUtils, CCClasses } from '@buerli.io/classcad'
import { getDescendants } from '../ContextMenu/utils'

export type PointInfo = { id: ObjectID; pos: THREE.Vector2 }
export type LineInfo = { id: ObjectID; startPos: THREE.Vector2; endPos: THREE.Vector2 }
export type ArcInfo = {
  id: ObjectID
  startPosL: THREE.Vector2
  endPosL: THREE.Vector2
  centerPosL: THREE.Vector2
  startPosH: THREE.Vector2
  endPosH: THREE.Vector2
  centerPosH: THREE.Vector2
  bulge: number
}
export type CircleInfo = {
  id: ObjectID
  centerPosL: THREE.Vector2
  centerPosH: THREE.Vector2
  p1PosH: THREE.Vector2
  p2PosH: THREE.Vector2
  radius: number }
export type SketchInfo = { points: PointInfo[]; lines: LineInfo[]; arcs: ArcInfo[]; circles: CircleInfo[] }
export type SolidInfo = { id: ObjectID; bb: THREE.Box2 }
export type InstanceInfo = SolidInfo

export const convertToVector = (point: PointMem | undefined) => {
  return point ? new THREE.Vector3(point.value.x, point.value.y, point.value.z) : new THREE.Vector3()
}

export const getPointOnPlane = (unprojectedPoint: THREE.Vector3, camera: THREE.Camera, globalToLocalM: THREE.Matrix4) => {
  const cameraDir = new THREE.Vector3()
  camera.getWorldDirection(cameraDir)
  const ray = new THREE.Ray(unprojectedPoint.clone(), cameraDir)
  // For perspective camera, use:
  // const ray = new THREE.Ray(camera.position.clone(), e.unprojectedPoint.clone().sub(camera.position.clone()))
  ray.applyMatrix4(globalToLocalM)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
  const result = new THREE.Vector3()
  ray.intersectPlane(plane, result)
  ray.direction.negate()
  ray.intersectPlane(plane, result)

  return new THREE.Vector2(result.x, result.y)
}

export const linesIntersection = (point1: THREE.Vector2, dir1: THREE.Vector2, point2: THREE.Vector2, dir2: THREE.Vector2) => {
  if (Math.abs(dir1.clone().cross(dir2)) < 1e-3) {
    return null
  }

  if (dir1.x === 0) {
    const a2 = dir2.y / dir2.x
    const b2 = point2.y - a2 * point2.x

    const x = point1.x
    const y = a2 * x + b2

    return new THREE.Vector2(x, y)
  } else if (dir2.x === 0) {
    const a1 = dir1.y / dir1.x
    const b1 = point1.y - a1 * point1.x

    const x = point2.x
    const y = a1 * x + b1

    return new THREE.Vector2(x, y)
  } else {
    const a1 = dir1.y / dir1.x
    const b1 = point1.y - a1 * point1.x
    const a2 = dir2.y / dir2.x
    const b2 = point2.y - a2 * point2.x

    const x = (b2 - b1) / (a1 - a2)
    const y = a1 * x + b1

    return new THREE.Vector2(x, y)
  }
}

export const lineSegmentsIntersection = (a1: THREE.Vector2, a2: THREE.Vector2, b1: THREE.Vector2, b2: THREE.Vector2) => {
  const dirA = a2.clone().sub(a1)
  const dirB = b2.clone().sub(b1)

  const intersection = linesIntersection(a1, dirA, b1, dirB)

  const err = 1e-4
  const minA = new THREE.Vector2(Math.min(a1.x, a2.x) - err, Math.min(a1.y, a2.y) - err)
  const maxA = new THREE.Vector2(Math.max(a1.x, a2.x) + err, Math.max(a1.y, a2.y) + err)
  const minB = new THREE.Vector2(Math.min(b1.x, b2.x) - err, Math.min(b1.y, b2.y) - err)
  const maxB = new THREE.Vector2(Math.max(b1.x, b2.x) + err, Math.max(b1.y, b2.y) + err)

  if (
    intersection &&
    intersection.x >= minA.x &&
    intersection.x <= maxA.x &&
    intersection.y >= minA.y &&
    intersection.y <= maxA.y &&
    intersection.x >= minB.x &&
    intersection.x <= maxB.x &&
    intersection.y >= minB.y &&
    intersection.y <= maxB.y
  ) {
    return intersection
  }

  return null
}

export const lineCircleIntersection = (
  linePoint: THREE.Vector2,
  lineDir: THREE.Vector2,
  circleCenter: THREE.Vector2,
  circleRadius: number,
) => {
  if (lineDir.x === 0) {
    const d = circleRadius * circleRadius - (linePoint.x - circleCenter.x) * (linePoint.x - circleCenter.x)
    if (d < 0) {
      return null
    } else if (d === 0) {
      return [new THREE.Vector2(linePoint.x, circleCenter.y)]
    } else {
      const dsqrt = Math.sqrt(d)
      return [
        new THREE.Vector2(linePoint.x, circleCenter.y + dsqrt),
        new THREE.Vector2(linePoint.x, circleCenter.y - dsqrt),
      ]
    }
  } else {
    const k = lineDir.y / lineDir.x
    const m = linePoint.y - k * linePoint.x
    const a = 1 + k * k
    const b = 2 * (k * m - k * circleCenter.y - circleCenter.x)
    const c =
      m * m -
      2 * m * circleCenter.y +
      circleCenter.x * circleCenter.x +
      circleCenter.y * circleCenter.y -
      circleRadius * circleRadius

    const d = b * b - 4 * a * c
    if (d < 0) {
      return null
    } else if (d === 0) {
      const x = -b / (2 * a)
      const y = k * x + m

      return [new THREE.Vector2(x, y)]
    } else {
      const dsqrt = Math.sqrt(d)
      const x1 = (-b + dsqrt) / (2 * a)
      const y1 = k * x1 + m
      const x2 = (-b - dsqrt) / (2 * a)
      const y2 = k * x2 + m

      return [new THREE.Vector2(x1, y1), new THREE.Vector2(x2, y2)]
    }
  }
}

export function lineSegmentCircleIntersection(
  linePoint1: THREE.Vector2,
  linePoint2: THREE.Vector2,
  circleCenter: THREE.Vector2,
  circleRadius: number,
) {
  const dir = linePoint2.clone().sub(linePoint1)

  const intersections = lineCircleIntersection(linePoint1, dir, circleCenter, circleRadius)

  const err = 1e-4
  const min = new THREE.Vector2(Math.min(linePoint1.x, linePoint2.x) - err, Math.min(linePoint1.y, linePoint2.y) - err)
  const max = new THREE.Vector2(Math.max(linePoint1.x, linePoint2.x) + err, Math.max(linePoint1.y, linePoint2.y) + err)

  const intersectionsFiltered =
    intersections &&
    (intersections.filter(point => point.x >= min.x && point.x <= max.x && point.y >= min.y && point.y <= max.y) ||
      null)
  return intersectionsFiltered && intersectionsFiltered.length > 0 ? intersectionsFiltered : null
}

export const lineSegmentArcIntersection = (
  linePoint1: THREE.Vector2,
  linePoint2: THREE.Vector2,
  arcCenter: THREE.Vector2,
  arcStart: THREE.Vector2,
  arcEnd: THREE.Vector2,
  arcBulge: number,
) => {
  const radius = arcCenter.distanceTo(arcStart)
  let startAngle = Math.atan2(arcStart.y - arcCenter.y, arcStart.x - arcCenter.x)
  let endAngle = Math.atan2(arcEnd.y - arcCenter.y, arcEnd.x - arcCenter.x)
  if (startAngle < 0.0) startAngle += 2 * Math.PI
  if (endAngle < 0.0) endAngle += 2 * Math.PI
  if (arcBulge < 0.0) [startAngle, endAngle] = [endAngle, startAngle]
  if (endAngle < startAngle) endAngle += 2 * Math.PI

  const intersections = lineSegmentCircleIntersection(linePoint1, linePoint2, arcCenter, radius)

  const intersectionsFiltered =
    intersections &&
    intersections.filter(point => {
      const intersectionAngle = Math.atan2(point.y - arcCenter.y, point.x - arcCenter.x)
      return (
        (intersectionAngle >= startAngle && intersectionAngle <= endAngle) ||
        (intersectionAngle + 2 * Math.PI >= startAngle && intersectionAngle + 2 * Math.PI <= endAngle)
      )
    })
  return intersectionsFiltered && intersectionsFiltered.length > 0 ? intersectionsFiltered : null
}

export const getSketchGeomInfo = (drawingId: DrawingID, sketchId: ObjectID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const sketchDescendants = getDescendants(drawingId, sketchId)
  const sketchMatrix = drawing.api.structure.calculateGlobalTransformation(sketchId)

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
      const pos = convertToVector(sketchObj.members?.pos as PointMem).applyMatrix4(sketchMatrix).project(camera)
      points.push({ id, pos: new THREE.Vector2(pos.x, pos.y) })

      return
    }

    if (ccUtils.base.isA(objClass, CCClasses.CCLine)) {
      const points_ = sketchObj.children?.map(pointId => tree[pointId]) || []
      const [sp, ep] = points_
        .map(p => convertToVector(p.members?.pos as PointMem).applyMatrix4(sketchMatrix).project(camera))
      lines.push({ id, startPos: new THREE.Vector2(sp.x, sp.y), endPos: new THREE.Vector2(ep.x, ep.y) })

      return
    }

    if (ccUtils.base.isA(objClass, CCClasses.CCArc)) {
      const points_ = sketchObj.children?.map(pointId => tree[pointId]) || []
      const [spL, epL, cpL] = ['startPoint', 'endPoint', 'center'].map(name => {
        const point = points_.find(p => p.name === name)
        return point ? convertToVector(point.members?.pos as PointMem) : new THREE.Vector3()
      })
      const [spH, epH, cpH] = [spL, epL, cpL].map(pos => {
        return pos.clone().applyMatrix4(sketchMatrix).project(camera)
      })
      const bulge = sketchObj.members?.bulge?.value as number
      arcs.push({
        id,
        startPosL: new THREE.Vector2(spL.x, spL.y),
        endPosL: new THREE.Vector2(epL.x, epL.y),
        centerPosL: new THREE.Vector2(cpL.x, cpL.y),
        startPosH: new THREE.Vector2(spH.x, spH.y),
        endPosH: new THREE.Vector2(epH.x, epH.y),
        centerPosH: new THREE.Vector2(cpH.x, cpH.y),
        bulge,
      })

      return
    }

    if (ccUtils.base.isA(objClass, CCClasses.CCCircle)) {
      const radius = sketchObj.members?.radius?.value as number
      const center = tree[sketchObj.children?.[0] || -1]
      const cpL = convertToVector(center?.members?.pos as PointMem)
      const p1L = cpL.clone().setX(cpL.x + radius)
      const p2L = cpL.clone().setY(cpL.y + radius)
      const [cpH, p1H, p2H] = [cpL, p1L, p2L].map(pos => pos.clone().applyMatrix4(sketchMatrix).project(camera))
      circles.push({
        id,
        centerPosL: new THREE.Vector2(cpL.x, cpL.y),
        centerPosH: new THREE.Vector2(cpH.x, cpH.y),
        p1PosH: new THREE.Vector2(p1H.x, p1H.y),
        p2PosH: new THREE.Vector2(p2H.x, p2H.y),
        radius,
      })

      return
    }
  })

  return { points, lines, arcs, circles }
}

export const getSolidsInfo = (drawingId: DrawingID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree
  const curProduct = drawing.structure.currentProduct as ObjectID

  const solidIds = tree[curProduct]?.solids || []
  const solidsInfo = solidIds.map(id => {
    const solid = drawing.geometry.cache[id]
    if (!solid) {
      // Shouldn't happen. But if it does for whatever reason, return an uncreachable bounding box.
      return { id, bb: new THREE.Box2(new THREE.Vector2(Infinity, Infinity), new THREE.Vector2(Infinity, Infinity)) }
    }

    const { min, max } = solid.box
    const bbPointsL = [
      min.clone(),
      min.clone().setX(max.x),
      min.clone().setY(max.y),
      min.clone().setZ(max.z),
      max.clone().setX(min.x),
      max.clone().setY(min.y),
      max.clone().setZ(min.z),
      max.clone(),
    ]
    const bbPointsH = bbPointsL.map(bbPoint => bbPoint.project(camera))

    const xPoints = bbPointsH.map(bbPoint => bbPoint.x)
    const yPoints = bbPointsH.map(bbPoint => bbPoint.y)
    const minV2 = new THREE.Vector2(Math.min(...xPoints), Math.min(...yPoints))
    const maxV2 = new THREE.Vector2(Math.max(...xPoints), Math.max(...yPoints))
    const bb2 = new THREE.Box2(minV2, maxV2)

    return { id, bb: bb2 } as SolidInfo
  })

  return solidsInfo
}

export const getInstancesInfo = (drawingId: DrawingID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree
  const curInstance = drawing.structure.currentInstance

  const descendants = getDescendants(drawingId, curInstance || -1)
  const instanceIds = descendants.filter(id => {
    const productId = tree[id]?.members?.productId?.value as ObjectID
    return ccUtils.base.isA(tree[id]?.class, CCClasses.IProductReference) && ccUtils.base.isA(tree[productId]?.class, CCClasses.CCPart)
  })

  const instancesInfo = instanceIds.map(id => {
    // I don't use drawing.api.structure.calculateProductBounds here because the resulting bounding boxes are bigger (which would lead to less accurate selections)
    // That's because the instance transforms in it are applied before the union operation
    const transform = drawing.api.structure.calculateGlobalTransformation(id)
    const productId = tree[id]?.members?.productId?.value as ObjectID
    const solidIds = tree[productId]?.solids || []
    let bb = new THREE.Box3()
    solidIds.forEach(solidId => {
      const solid = drawing.geometry.cache[solidId]
      if (!solid) {
        return
      }

      const bbSolid = new THREE.Box3(solid.box.min, solid.box.max)
      bb = bb.union(bbSolid)
    })

    const bbPointsL = [
      bb.min.clone(),
      bb.min.clone().setX(bb.max.x),
      bb.min.clone().setY(bb.max.y),
      bb.min.clone().setZ(bb.max.z),
      bb.max.clone().setX(bb.min.x),
      bb.max.clone().setY(bb.min.y),
      bb.max.clone().setZ(bb.min.z),
      bb.max.clone(),
    ]
    const bbPointsH = bbPointsL.map(bbPoint => bbPoint.applyMatrix4(transform).project(camera))

    const xPoints = bbPointsH.map(bbPoint => bbPoint.x)
    const yPoints = bbPointsH.map(bbPoint => bbPoint.y)
    const min = new THREE.Vector2(Math.min(...xPoints), Math.min(...yPoints))
    const max = new THREE.Vector2(Math.max(...xPoints), Math.max(...yPoints))
    const bb2 = new THREE.Box2(min, max)

    return { id, bb: bb2 } as InstanceInfo
  })

  return instancesInfo
}

const bb01 = new THREE.Vector2()
const bb10 = new THREE.Vector2()

export const containsSketchPoint = (bb: THREE.Box2, pointInfo: PointInfo) => {
  const { min, max } = bb
  const { pos } = pointInfo

  return pos.x >= min.x && pos.x <= max.x && pos.y >= min.y && pos.y <= max.y
}

export const containsSketchLine = (bb: THREE.Box2, lineInfo: LineInfo) => {
  const { min, max } = bb
  const { startPos: sp, endPos: ep } = lineInfo

  return (sp.x >= min.x && sp.x <= max.x && sp.y >= min.y && sp.y <= max.y) &&
    (ep.x >= min.x && ep.x <= max.x && ep.y >= min.y && ep.y <= max.y)
}

export const touchesSketchLine = (bb: THREE.Box2, lineInfo: LineInfo) => {
  const { min, max } = bb
  const { startPos: sp, endPos: ep } = lineInfo
  bb01.set(bb.max.x, bb.min.y)
  bb10.set(bb.min.x, bb.max.y)

  return (sp.x >= min.x && sp.x <= max.x && sp.y >= min.y && sp.y <= max.y) ||
    (ep.x >= min.x && ep.x <= max.x && ep.y >= min.y && ep.y <= max.y) ||
    lineSegmentsIntersection(sp, ep, bb.min, bb01) !== null ||
    lineSegmentsIntersection(sp, ep, bb.min, bb10) !== null ||
    lineSegmentsIntersection(sp, ep, bb01, bb.max) !== null ||
    lineSegmentsIntersection(sp, ep, bb10, bb.max) !== null
}

export const containsSketchArc = (bb: THREE.Box2, arcInfo: ArcInfo, sketchPos00: THREE.Vector2, sketchPos01: THREE.Vector2, sketchPos10: THREE.Vector2, sketchPos11: THREE.Vector2) => {
  const { min, max } = bb
  const { startPosL: spL, endPosL: epL, centerPosL: cpL, startPosH: spH, endPosH: epH, bulge } = arcInfo

  // TODO: Not entirely sure if situations when both points are exactly touched without arc intersections are possible
  // If it ever emerges, also calculate a midpoint here and check if it is within the rectangle
  return (spH.x >= min.x && spH.x <= max.x && spH.y >= min.y && spH.y <= max.y) &&
    (epH.x >= min.x && epH.x <= max.x && epH.y >= min.y && epH.y <= max.y) &&
    lineSegmentArcIntersection(sketchPos00, sketchPos01, cpL, spL, epL, bulge) === null &&
    lineSegmentArcIntersection(sketchPos00, sketchPos10, cpL, spL, epL, bulge) === null &&
    lineSegmentArcIntersection(sketchPos01, sketchPos11, cpL, spL, epL, bulge) === null &&
    lineSegmentArcIntersection(sketchPos10, sketchPos11, cpL, spL, epL, bulge) === null
}

export const touchesSketchArc = (bb: THREE.Box2, arcInfo: ArcInfo, sketchPos00: THREE.Vector2, sketchPos01: THREE.Vector2, sketchPos10: THREE.Vector2, sketchPos11: THREE.Vector2) => {
  const { min, max } = bb
  const { startPosL: spL, endPosL: epL, centerPosL: cpL, startPosH: spH, endPosH: epH, bulge } = arcInfo

  return (spH.x >= min.x && spH.x <= max.x && spH.y >= min.y && spH.y <= max.y) ||
    (epH.x >= min.x && epH.x <= max.x && epH.y >= min.y && epH.y <= max.y) ||
    lineSegmentArcIntersection(sketchPos00, sketchPos01, cpL, spL, epL, bulge) !== null ||
    lineSegmentArcIntersection(sketchPos00, sketchPos10, cpL, spL, epL, bulge) !== null ||
    lineSegmentArcIntersection(sketchPos01, sketchPos11, cpL, spL, epL, bulge) !== null ||
    lineSegmentArcIntersection(sketchPos10, sketchPos11, cpL, spL, epL, bulge) !== null
}

export const containsSketchCircle = (bb: THREE.Box2, circleInfo: CircleInfo, sketchPos00: THREE.Vector2, sketchPos01: THREE.Vector2, sketchPos10: THREE.Vector2, sketchPos11: THREE.Vector2) => {
  const { min, max } = bb
  const { centerPosL: cpL, p1PosH: p1H, p2PosH: p2H, radius } = circleInfo

  return (p1H.x >= min.x && p1H.x <= max.x && p1H.y >= min.y && p1H.y <= max.y) &&
    (p2H.x >= min.x && p2H.x <= max.x && p2H.y >= min.y && p2H.y <= max.y) &&
    lineSegmentCircleIntersection(sketchPos00, sketchPos01, cpL, radius) === null &&
    lineSegmentCircleIntersection(sketchPos00, sketchPos10, cpL, radius) === null &&
    lineSegmentCircleIntersection(sketchPos01, sketchPos11, cpL, radius) === null &&
    lineSegmentCircleIntersection(sketchPos10, sketchPos11, cpL, radius) === null
}

export const touchesSketchCircle = (bb: THREE.Box2, circleInfo: CircleInfo, sketchPos00: THREE.Vector2, sketchPos01: THREE.Vector2, sketchPos10: THREE.Vector2, sketchPos11: THREE.Vector2) => {
  const { min, max } = bb
  const { centerPosL: cpL, p1PosH: p1H, radius } = circleInfo

  return (p1H.x >= min.x && p1H.x <= max.x && p1H.y >= min.y && p1H.y <= max.y) ||
    lineSegmentCircleIntersection(sketchPos00, sketchPos01, cpL, radius) !== null ||
    lineSegmentCircleIntersection(sketchPos00, sketchPos10, cpL, radius) !== null ||
    lineSegmentCircleIntersection(sketchPos01, sketchPos11, cpL, radius) !== null ||
    lineSegmentCircleIntersection(sketchPos10, sketchPos11, cpL, radius) !== null
}
