import * as THREE from 'three'

import { DrawingID, getDrawing, ObjectID, PointMem } from '@buerli.io/core'
import { ccUtils, CCClasses } from '@buerli.io/classcad'
import { sketchIntersectionUtils } from '@buerli.io/react-cad'

type CommonInfo = { id: ObjectID }
export type PointInfo = { id: ObjectID; pos: THREE.Vector3 }
export type LineInfo = sketchIntersectionUtils.CCLineInfo & CommonInfo
export type ArcInfo = sketchIntersectionUtils.CCArcInfo & { startH: THREE.Vector3; endH: THREE.Vector3} & CommonInfo
export type CircleInfo = sketchIntersectionUtils.CCCircleInfo & { pos1H: THREE.Vector3; pos2H: THREE.Vector3 } & CommonInfo
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

  return result
}

export const getSketchGeomInfo = (drawingId: DrawingID, sketchId: ObjectID, camera: THREE.Camera) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree

  const sketchDescendants = ccUtils.base.getDescendants(drawingId, sketchId)
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
      points.push({ id, pos })

      return
    }

    if (ccUtils.base.isA(objClass, CCClasses.CCLine)) {
      const points_ = sketchObj.children?.map(pointId => tree[pointId]) || []
      const [start, end] = points_
        .map(p => convertToVector(p.members?.pos as PointMem).applyMatrix4(sketchMatrix).project(camera))
      const dir = end.clone().sub(start)

      lines.push({ id, start, end, dir })

      return
    }

    if (ccUtils.base.isA(objClass, CCClasses.CCArc)) {
      const points_ = sketchObj.children?.map(pointId => tree[pointId]) || []
      const [start, end, center] = ['startPoint', 'endPoint', 'center'].map(name => {
        const point = points_.find(p => p.name === name)
        return point ? convertToVector(point.members?.pos as PointMem) : new THREE.Vector3()
      })
      const [startH, endH] = [start, end].map(pos => {
        return pos.clone().applyMatrix4(sketchMatrix).project(camera)
      })

      const radius = sketchObj.members?.radius?.value as number
      const clockwise = (sketchObj.members?.bulge?.value as number) < 0

      const startDir = start.clone().sub(center)
      const endDir = end.clone().sub(center)

      let startAngle = Math.atan2(startDir.y, startDir.x)
      let endAngle = Math.atan2(endDir.y, endDir.x)
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
      const pos1L = centerL.clone().setX(centerL.x + radius)
      const pos2L = centerL.clone().setY(centerL.y + radius)
      const [pos1H, pos2H] = [pos1L, pos2L].map(pos => pos.clone().applyMatrix4(sketchMatrix).project(camera))
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

  const descendants = ccUtils.base.getDescendants(drawingId, curInstance || -1)
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

const bb00 = new THREE.Vector3()
const bb01 = new THREE.Vector3()
const bb10 = new THREE.Vector3()
const bb11 = new THREE.Vector3()
const dir_ = new THREE.Vector3()

const bb2ToV3 = (bb: THREE.Box2) => {
  bb00.set(bb.min.x, bb.min.y, 0.0)
  bb01.set(bb.max.x, bb.min.y, 0.0)
  bb10.set(bb.min.x, bb.max.y, 0.0)
  bb11.set(bb.max.x, bb.max.y, 0.0)
}

const intersectsLine = (lineStart: THREE.Vector3, lineEnd: THREE.Vector3, lineInfo: LineInfo) => {
  dir_.copy(lineEnd).sub(lineStart)
  const intersections = sketchIntersectionUtils.intersectLineLine({ start: lineStart, end: lineEnd, dir: dir_ }, lineInfo)

  return intersections[1].length > 0
}

const intersectsArc = (lineStart: THREE.Vector3, lineEnd: THREE.Vector3, arcInfo: ArcInfo) => {
  dir_.copy(lineEnd).sub(lineStart)
  const intersections = sketchIntersectionUtils.intersectLineArc({ start: lineStart, end: lineEnd, dir: dir_ }, arcInfo)

  return intersections[1].length > 0
}

const intersectsCircle = (lineStart: THREE.Vector3, lineEnd: THREE.Vector3, circleInfo: CircleInfo) => {
  dir_.copy(lineEnd).sub(lineStart)
  const intersections = sketchIntersectionUtils.intersectLineCircle({ start: lineStart, end: lineEnd, dir: dir_ }, circleInfo)

  return intersections[1].length > 0
}

export const containsSketchPoint = (bb: THREE.Box2, pointInfo: PointInfo) => {
  const { min, max } = bb
  const { pos } = pointInfo

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
    intersectsLine(bb00, bb01, lineInfo) ||
    intersectsLine(bb00, bb10, lineInfo) ||
    intersectsLine(bb01, bb11, lineInfo) ||
    intersectsLine(bb10, bb11, lineInfo)
}

export const containsSketchArc = (bb: THREE.Box2, arcInfo: ArcInfo, sketchPos00: THREE.Vector3, sketchPos01: THREE.Vector3, sketchPos10: THREE.Vector3, sketchPos11: THREE.Vector3) => {
  const { min, max } = bb
  const { startH: spH, endH: epH } = arcInfo
  bb2ToV3(bb)

  // TODO: Not entirely sure if situations when both points are exactly touched without arc intersections are possible
  // If it ever emerges, also calculate a midpoint here and check if it is within the rectangle
  return (spH.x >= min.x && spH.x <= max.x && spH.y >= min.y && spH.y <= max.y) &&
    (epH.x >= min.x && epH.x <= max.x && epH.y >= min.y && epH.y <= max.y) &&
    !intersectsArc(sketchPos00, sketchPos01, arcInfo) &&
    !intersectsArc(sketchPos00, sketchPos10, arcInfo) &&
    !intersectsArc(sketchPos01, sketchPos11, arcInfo) &&
    !intersectsArc(sketchPos10, sketchPos11, arcInfo)
}

export const touchesSketchArc = (bb: THREE.Box2, arcInfo: ArcInfo, sketchPos00: THREE.Vector3, sketchPos01: THREE.Vector3, sketchPos10: THREE.Vector3, sketchPos11: THREE.Vector3) => {
  const { min, max } = bb
  const { startH: spH, endH: epH } = arcInfo

  return (spH.x >= min.x && spH.x <= max.x && spH.y >= min.y && spH.y <= max.y) ||
    (epH.x >= min.x && epH.x <= max.x && epH.y >= min.y && epH.y <= max.y) ||
    intersectsArc(sketchPos00, sketchPos01, arcInfo) ||
    intersectsArc(sketchPos00, sketchPos10, arcInfo) ||
    intersectsArc(sketchPos01, sketchPos11, arcInfo) ||
    intersectsArc(sketchPos10, sketchPos11, arcInfo)
}

export const containsSketchCircle = (bb: THREE.Box2, circleInfo: CircleInfo, sketchPos00: THREE.Vector3, sketchPos01: THREE.Vector3, sketchPos10: THREE.Vector3, sketchPos11: THREE.Vector3) => {
  const { min, max } = bb
  const { pos1H: p1H, pos2H: p2H } = circleInfo

  return (p1H.x >= min.x && p1H.x <= max.x && p1H.y >= min.y && p1H.y <= max.y) &&
    (p2H.x >= min.x && p2H.x <= max.x && p2H.y >= min.y && p2H.y <= max.y) &&
    !intersectsCircle(sketchPos00, sketchPos01, circleInfo) &&
    !intersectsCircle(sketchPos00, sketchPos10, circleInfo) &&
    !intersectsCircle(sketchPos01, sketchPos11, circleInfo) &&
    !intersectsCircle(sketchPos10, sketchPos11, circleInfo)
}

export const touchesSketchCircle = (bb: THREE.Box2, circleInfo: CircleInfo, sketchPos00: THREE.Vector3, sketchPos01: THREE.Vector3, sketchPos10: THREE.Vector3, sketchPos11: THREE.Vector3) => {
  const { min, max } = bb
  const { pos1H: p1H } = circleInfo

  return (p1H.x >= min.x && p1H.x <= max.x && p1H.y >= min.y && p1H.y <= max.y) ||
    intersectsCircle(sketchPos00, sketchPos01, circleInfo) ||
    intersectsCircle(sketchPos00, sketchPos10, circleInfo) ||
    intersectsCircle(sketchPos01, sketchPos11, circleInfo) ||
    intersectsCircle(sketchPos10, sketchPos11, circleInfo)
}
