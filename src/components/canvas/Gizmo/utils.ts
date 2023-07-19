import * as THREE from 'three'

import { DrawingID, getDrawing, ObjectID } from '@buerli.io/core'

// Intersection object should be a line
const getAdjacentMeshNormal = (
  drawingId: DrawingID,
  graphicId: ObjectID,
  intersection: THREE.Intersection,
  clickPos: THREE.Vector3,
) => {
  const drawing = getDrawing(drawingId)
  const meshes = drawing.geometry.cache[intersection.object.userData.containerId].meshes
  const adjacentMeshes = meshes.filter(mesh => mesh.loops.some(loop => loop.indexOf(graphicId) !== -1))

  const planeMesh = adjacentMeshes.find(mesh => mesh.type === 'plane') as any
  if (planeMesh) {
    return planeMesh.normal.clone() as THREE.Vector3
  }

  const cylinderMesh = adjacentMeshes.find(mesh => mesh.type === 'cylinder') as any
  if (cylinderMesh) {
    const axis = cylinderMesh.axis.clone()
    const frontVec = cylinderMesh.origin.clone().sub(clickPos)
    const tangent = frontVec.clone().cross(axis)
    const normal = axis.clone().cross(tangent).normalize()

    return normal as THREE.Vector3
  }

  const coneMesh = adjacentMeshes.find(mesh => mesh.type === 'cone') as any
  if (coneMesh) {
    const posL = clickPos.clone().sub(coneMesh.origin)
    const bottomPlane = new THREE.Plane(coneMesh.axis)
    const posProj = new THREE.Vector3()
    bottomPlane.projectPoint(posL, posProj)
    posProj.setLength(coneMesh.radiusBottom)
    const tangent = posL.clone().sub(posProj)
    const binormal = tangent.clone().cross(posL)
    const normal = binormal.clone().cross(tangent).normalize()

    return normal as THREE.Vector3
  }

  const nurbsMesh = adjacentMeshes[0] as any
  if (nurbsMesh) {
    return intersection.face?.normal.clone().normalize() || new THREE.Vector3(0, 0, 1)
  }

  return new THREE.Vector3(0, 0, 1)
}

export const findInteractableParent = (drawingId: DrawingID, refId: ObjectID) => {
  const drawing = getDrawing(drawingId)
  const curNodeId = drawing.structure.currentNode || -1
  const curNode = drawing.structure.tree[curNodeId]
  const interactable = curNode?.children || []

  const ancestors: ObjectID[] = []
  let objId: number | null = refId
  while (objId) {
    ancestors.push(objId)
    objId = drawing.structure.tree[objId].parent
  }

  return ancestors.find(id => interactable.indexOf(id) !== -1)
}

export const getGizmoInfo = (drawingId: DrawingID, intersection: THREE.Intersection, cameraRay: THREE.Ray) => {
  const object = intersection?.object
  if (!object) {
    return null
  }

  const drawing = getDrawing(drawingId)
  const productId = object.userData.productId

  if (typeof intersection.index === 'number' && object.userData.pointMap) {
    const point = object.userData.pointMap[intersection.index]
    if (point) {
      const matrix = new THREE.Matrix4().setPosition(point.position)

      return { productId, matrix }
    }
  } else if (typeof intersection.index === 'number' && object.userData.lineMap) {
    // Line
    const line = object.userData.lineMap[intersection.index || 0]
    if (line) {
      const mWInv = drawing.api.structure.calculateGlobalTransformation(productId).invert()
      const pos = intersection.point.clone().applyMatrix4(mWInv)
      const rayL = cameraRay.clone().applyMatrix4(mWInv)

      if (line.type === 'arc' || line.type === 'circle') {
        const zAxis = line.normal.clone().normalize()
        const frontVec = line.center.clone().sub(pos)
        if (frontVec.dot(rayL.direction) > 0) {
          frontVec.negate()
        }
        const xAxis = frontVec.clone().cross(zAxis).normalize()
        const yAxis = zAxis.clone().cross(xAxis).normalize()
        const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)

        return { productId, matrix }
      } else if (line.type === 'line') {
        const zAxis = line.end.clone().sub(line.start).normalize()
        const meshNormal = getAdjacentMeshNormal(drawingId, line.graphicId, intersection, pos)
        if (meshNormal.dot(rayL.direction) > 0) {
          meshNormal.negate()
        }
        const xAxis = meshNormal.cross(zAxis).normalize()
        const yAxis = zAxis.clone().cross(xAxis).normalize()
        const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)

        return { productId, matrix }
      } else {
        const lineCount = line.rawGraphic.points.length / 3 - 1
        const point = new THREE.Vector3()
        const dir = new THREE.Vector3()
        const kVec = new THREE.Vector3()
        const zAxis = line.end.clone().sub(line.start)
        for (let i = 0; i < lineCount; i++) {
          point.set(
            line.rawGraphic.points[i * 3],
            line.rawGraphic.points[i * 3 + 1],
            line.rawGraphic.points[i * 3 + 2],
          )
          dir
            .set(
              line.rawGraphic.points[i * 3 + 3],
              line.rawGraphic.points[i * 3 + 4],
              line.rawGraphic.points[i * 3 + 5],
            )
            .sub(point)
          kVec.copy(pos).sub(point).divide(dir)
          if (
            kVec.x >= 0 &&
            kVec.x <= 1 &&
            kVec.y >= 0 &&
            kVec.y <= 1 &&
            kVec.z >= 0 &&
            kVec.z <= 1 &&
            Math.abs(kVec.x - kVec.y) < 1e-3 &&
            Math.abs(kVec.x - kVec.z) < 1e-3
          ) {
            zAxis.copy(dir)
            break
          }
        }

        zAxis.normalize()
        const meshNormal = getAdjacentMeshNormal(drawingId, line.graphicId, intersection, pos)
        if (meshNormal.dot(rayL.direction) > 0) {
          meshNormal.negate()
        }
        const xAxis = meshNormal.cross(zAxis).normalize()
        const yAxis = zAxis.clone().cross(xAxis).normalize()
        const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)

        return { productId, matrix }
      }
    }
  } else if (typeof intersection.faceIndex === 'number' && Boolean(object.userData.meshMap)) {
    // Mesh
    const mesh = object.userData.meshMap[intersection.faceIndex || 0]
    if (mesh) {
      const mWInv = drawing.api.structure.calculateGlobalTransformation(productId).invert()
      const pos = intersection.point.clone().applyMatrix4(mWInv)
      const rayL = cameraRay.clone().applyMatrix4(mWInv)

      if (mesh.type === 'plane') {
        const zAxis = mesh.normal.clone().normalize()
        if (zAxis.dot(rayL.direction) > 0) {
          zAxis.negate()
        }
        const frontVec = zAxis.y !== 1 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
        const xAxis = frontVec.clone().cross(zAxis).normalize()
        const yAxis = zAxis.clone().cross(xAxis).normalize()
        const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)

        return { productId, matrix }
      } else if (mesh.type === 'cylinder') {
        const zAxis = mesh.axis.clone().normalize()
        const frontVec = mesh.origin.clone().sub(pos)
        if (frontVec.dot(rayL.direction) > 0) {
          frontVec.negate()
        }
        const xAxis = frontVec.clone().cross(zAxis).normalize()
        const yAxis = zAxis.clone().cross(xAxis).normalize()
        const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)

        return { productId, matrix }
      } else if (mesh.type === 'cone') {
        const posL = pos.clone().sub(mesh.origin)
        const bottomPlane = new THREE.Plane(mesh.axis)
        const posProj = new THREE.Vector3()
        bottomPlane.projectPoint(posL, posProj)
        posProj.setLength(mesh.radiusBottom)
        const yAxis = posL.clone().sub(posProj).normalize()
        const xAxis = yAxis.clone().cross(posL).normalize()
        const zAxis = xAxis.clone().cross(yAxis).normalize()
        if (zAxis.dot(rayL.direction) > 0) {
          xAxis.negate()
          zAxis.negate()
        }
        const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)

        return { productId, matrix }
      } else {
        const zAxis = intersection.face?.normal.clone().normalize() || new THREE.Vector3(0, 0, 1)
        if (zAxis.dot(rayL.direction) > 0) {
          zAxis.negate()
        }
        const frontVec = zAxis.y !== 1 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
        const xAxis = frontVec.clone().cross(zAxis).normalize()
        const yAxis = zAxis.clone().cross(xAxis).normalize()
        const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)

        return { productId, matrix }
      }
    }
  }

  return null
}
