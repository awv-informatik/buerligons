import React from 'react'
import * as THREE from 'three'

import { CCClasses, ccUtils, ccAPI } from '@buerli.io/classcad'
import { createInfo, DrawingID, getDrawing, MathUtils, ObjectID } from '@buerli.io/core'
import { GlobalTransform, useDrawing } from '@buerli.io/react'
import { HUD } from '@buerli.io/react-cad'
import { extend, Object3DNode, ThreeEvent } from '@react-three/fiber'

import { PivotControls } from '@react-three/drei'

class Background extends THREE.Object3D {
  public raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    const res = {
      distance: raycaster.far,
      distanceToRay: 0,
      point: raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, raycaster.far),
      index: 0,
      face: null,
      object: this,
    }
    intersects.push(res)
  }
}
  
extend({ Background })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      background: Object3DNode<Background, typeof Background>
    }
  }
}

/* const getNurbsNormal = (nurbsMesh: any, clickPos: THREE.Vector3) => {
  let closestId = 0
  let closestDistSq = Infinity
  const vertexCount = nurbsMesh.rawGraphic.vertices.length / 3
  const vertexPos = new THREE.Vector3()
  for (let i = 0; i < vertexCount; i++) {
    vertexPos.set(nurbsMesh.rawGraphic.vertices[i * 3], nurbsMesh.rawGraphic.vertices[i * 3 + 1], nurbsMesh.rawGraphic.vertices[i * 3 + 2])
    const distSq = vertexPos.distanceToSquared(clickPos)
    if (distSq < closestDistSq) {
      closestId = i
      closestDistSq = distSq
    }
  }

  const normal = new THREE.Vector3(
    nurbsMesh.rawGraphic.normals[closestId * 3],
    nurbsMesh.rawGraphic.normals[closestId * 3 + 1],
    nurbsMesh.rawGraphic.normals[closestId * 3 + 2],
  ).normalize()

  return normal
} */

// Intersection object should be a line
const getAdjacentMeshNormal = (drawingId: DrawingID, graphicId: ObjectID, intersection: THREE.Intersection, clickPos: THREE.Vector3) => {
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

const findInteractableParent = (drawingId: DrawingID, refId: ObjectID) => {
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

// Artificial delay in 16 ms.
const artifDelay = 16
let promise: Promise<void> | null

const GizmoWrapper: React.FC<{ drawingId: DrawingID; productId: ObjectID; matrix: THREE.Matrix4 }> = ({ drawingId, productId, matrix }) => {
  const dragInfo = React.useRef<{ mPInv: THREE.Matrix4; mL0CInv: THREE.Matrix4; draggedNodes: ObjectID[] } | null>(null)
  const mdL = React.useRef<THREE.Matrix4 | null>(null)

  const onDragStart = React.useCallback(() => {
    const drawing = getDrawing(drawingId)
    const curProdId = drawing.structure.currentProduct
    const curNodeId = drawing.structure.currentNode
    const draggedNodeId = findInteractableParent(drawingId, productId)
    if (!curProdId || !curNodeId || !draggedNodeId || !productId) {
      return
    }

    const mP = drawing.api.structure.calculateGlobalTransformation(curNodeId)
    const mPInv = mP.clone().invert()
    const mL0CInv = drawing.api.structure.calculateGlobalTransformation(productId).premultiply(mPInv).invert()
    
    const selected = (drawing.interaction.selected || [])
    const selectedRefs = selected.map(obj => obj.prodRefId ? findInteractableParent(drawingId, obj.prodRefId) : null)
    const selectedRefsUnique = selectedRefs.filter((refId, id) => refId && id === selectedRefs.indexOf(refId)) as ObjectID[]
    const draggedNodes = selectedRefsUnique.map(id => (drawing.structure.tree[id].members?.productRef?.value || id) as ObjectID)

    dragInfo.current = { mPInv, mL0CInv, draggedNodes }
    ccAPI.assemblyBuilder.startMovingUnderConstraints(drawingId, curProdId)
  }, [drawingId, productId])
  
  const transformNodes = React.useCallback(async (mdL_: THREE.Matrix4, draggedNodes: ObjectID[]) => {
    const curProdId = getDrawing(drawingId).structure.currentProduct || -1

    const rot: number[] = []
    const offset: number[] = []
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        rot.push(mdL_.elements[j * 4 + i])
      }
      offset.push(mdL_.elements[i + 12])
    }
    promise = ccAPI.assemblyBuilder.moveUnderConstraints(drawingId, curProdId, draggedNodes, rot, offset).catch(console.warn)
    await promise
  
    // Artificial slowdown to lessen network/server burden
    await new Promise(resolve => setTimeout(resolve, artifDelay))
    promise = null
    
    if (mdL.current) {
      transformNodes(mdL.current.clone(), draggedNodes)
      mdL.current = null
    }
  }, [drawingId])

  const onDrag = React.useCallback((l: THREE.Matrix4, deltaL: THREE.Matrix4, w: THREE.Matrix4, deltaW: THREE.Matrix4) => {
    if (!dragInfo.current) {
      return
    }

    const mdL_ = dragInfo.current.mPInv.clone().multiply(w).multiply(dragInfo.current.mL0CInv)
    
    if (promise) {
      mdL.current = mdL_
    } else {
      transformNodes(mdL_, dragInfo.current.draggedNodes)
    }
  }, [transformNodes])

  const onDragEnd = React.useCallback(() => {
    dragInfo.current = null
    const curProdId = getDrawing(drawingId).structure.currentProduct || -1
    ccAPI.assemblyBuilder.finishMovingUnderConstraints(drawingId, curProdId)
  }, [drawingId])

  const { position, rotation } = React.useMemo(() => {
    return {
      position: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),
      rotation: new THREE.Euler().setFromRotationMatrix(matrix).toArray() as [number, number, number],
    }
  }, [matrix])

  return (
    <HUD>
      <GlobalTransform drawingId={drawingId} objectId={productId}>
        <PivotControls scale={96} lineWidth={5} fixed onDragStart={onDragStart} onDrag={onDrag} onDragEnd={onDragEnd} offset={position} rotation={rotation} autoTransform={false} />
      </GlobalTransform>
    </HUD>
  )
}
  
export const GeometryInteraction: React.FC<{ drawingId: DrawingID }> = ({ drawingId, children }) => {
  const group = React.useRef<THREE.Group>(null!)

  const [gizmoInfo, setGizmoInfo] = React.useState<{ productId: ObjectID; matrix: THREE.Matrix4 } | null>(null)
  
  const onGeometryMove = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    const drawing = getDrawing(drawingId)
    const isSelActive = drawing.selection.active !== null
    const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
    const objClass = drawing.structure.tree[active?.id || -1]?.class || ''
    const isSketchActive = ccUtils.base.isA(objClass, CCClasses.CCSketch)

    if (isSelActive || isSketchActive) {
      return
    }

    e.stopPropagation()

    const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
    const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart) 
    const hovered = drawing.interaction.hovered
    const hoveredId = isPartMode ? hovered?.graphicId : hovered?.objectId

    if (e.buttons !== 0) {
      if (hoveredId) {
        const setHovered = drawing.api.interaction.setHovered
        setHovered(null)
      }

      return
    }

    const object = e.intersections.find(i => i.object.userData?.isBuerliGeometry)?.object
    if (!object) {
      return
    }

    const id = isPartMode ? object.userData.containerId : object.userData.productId
    if (id !== hoveredId) {
      const setHovered = drawing.api.interaction.setHovered

      isPartMode && setHovered(createInfo({
        objectId: drawing.geometry.cache[id].container.ownerId,
        graphicId: id,
        containerId: id,
        prodRefId: drawing.structure.currentProduct,
      }))
      !isPartMode && setHovered(createInfo({ objectId: id, prodRefId: id }))
    }
  }, [drawingId])

  const onBackgroundMove = React.useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()

    const drawing = getDrawing(drawingId)
    const isSelActive = drawing.selection.active !== null
    const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
    const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)
    const hovered = drawing.interaction.hovered
    const hoveredId = isPartMode ? hovered?.graphicId : hovered?.objectId

    const object = e.intersections.find(i => i.object.userData?.isBuerliGeometry)?.object

    if (!isSelActive && !object && hoveredId) {
      const setHovered = drawing.api.interaction.setHovered
      setHovered(null)
    }
  }, [drawingId])
    
  const onGeometryClick = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 0) {
      return
    }

    const drawing = getDrawing(drawingId)
    const isSelActive = drawing.selection.active !== null
    const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
    const objClass = drawing.structure.tree[active?.id || -1]?.class || ''
    const isSketchActive = ccUtils.base.isA(objClass, CCClasses.CCSketch)

    if (isSelActive || isSketchActive) {
      return
    }

    e.stopPropagation()

    const prodClass = drawing.structure.tree[drawing.structure.currentProduct || -1]?.class || ''
    const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

    const intersection = e.intersections.find(i => i.object.userData?.isBuerliGeometry)
    const object = intersection?.object
    if (!object) {
      return
    }

    const id = isPartMode ? object.userData.containerId : object.userData.productId
    if (!isSelActive) {
      if (!isPartMode) {
        const productId = object.userData.productId

        if (typeof intersection.index === 'number' && object.userData.pointMap) {
          const point = object.userData.pointMap[intersection.index]
          if (point) {
            const matrix = new THREE.Matrix4().setPosition(point.position)

            setGizmoInfo({ productId, matrix })
          }
        } else if (typeof intersection.index === 'number' && object.userData.lineMap) {
          // Line
          const line = object.userData.lineMap[intersection.index || 0]
          if (line) {
            const mWInv = drawing.api.structure.calculateGlobalTransformation(productId).invert()
            const pos = intersection.point.clone().applyMatrix4(mWInv)
            const rayL = e.ray.clone().applyMatrix4(mWInv)

            if (line.type === 'arc' || line.type === 'circle') {
              const zAxis = line.normal.clone().normalize()
              const frontVec = line.center.clone().sub(pos)
              if (frontVec.dot(rayL.direction) > 0) {
                frontVec.negate()
              }
              const xAxis = frontVec.clone().cross(zAxis).normalize()
              const yAxis = zAxis.clone().cross(xAxis).normalize()
              const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)
  
              setGizmoInfo({ productId, matrix })
            }
            else if (line.type === 'line') {
              const zAxis = line.end.clone().sub(line.start).normalize()
              const meshNormal = getAdjacentMeshNormal(drawingId, line.graphicId, intersection, pos)
              if (meshNormal.dot(rayL.direction) > 0) {
                meshNormal.negate()
              }
              const xAxis = meshNormal.cross(zAxis).normalize()
              const yAxis = zAxis.clone().cross(xAxis).normalize()
              const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)
  
              setGizmoInfo({ productId, matrix })
            }
            else {
              const lineCount = line.rawGraphic.points.length / 3 - 1
              const point = new THREE.Vector3()
              const dir = new THREE.Vector3()
              const kVec = new THREE.Vector3()
              const zAxis = line.end.clone().sub(line.start)
              for (let i = 0; i < lineCount; i++) {
                point.set(line.rawGraphic.points[i * 3], line.rawGraphic.points[i * 3 + 1], line.rawGraphic.points[i * 3 + 2])
                dir.set(line.rawGraphic.points[i * 3 + 3], line.rawGraphic.points[i * 3 + 4], line.rawGraphic.points[i * 3 + 5]).sub(point)
                kVec.copy(pos).sub(point).divide(dir)
                if (
                  kVec.x >= 0 && kVec.x <= 1 && kVec.y >= 0 && kVec.y <= 1 && kVec.z >= 0 && kVec.z <= 1
                  && Math.abs(kVec.x - kVec.y) < 1e-3 && Math.abs(kVec.x - kVec.z) < 1e-3
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
  
              setGizmoInfo({ productId, matrix })
            }
          }
        } else if (typeof intersection.faceIndex === 'number' && Boolean(object.userData.meshMap)) {
          // Mesh
          const mesh = object.userData.meshMap[intersection.faceIndex || 0]
          if (mesh) {
            const mWInv = drawing.api.structure.calculateGlobalTransformation(productId).invert()
            const pos = intersection.point.clone().applyMatrix4(mWInv)
            const rayL = e.ray.clone().applyMatrix4(mWInv)

            if (mesh.type === 'plane') {
              const zAxis = mesh.normal.clone().normalize()
              if (zAxis.dot(rayL.direction) > 0) {
                zAxis.negate()
              }
              const frontVec = zAxis.y !== 1 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
              const xAxis = frontVec.clone().cross(zAxis).normalize()
              const yAxis = zAxis.clone().cross(xAxis).normalize()
              const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)
  
              setGizmoInfo({ productId, matrix })
            }
            else if (mesh.type === 'cylinder') {
              const zAxis = mesh.axis.clone().normalize()
              const frontVec = mesh.origin.clone().sub(pos)
              if (frontVec.dot(rayL.direction) > 0) {
                frontVec.negate()
              }
              const xAxis = frontVec.clone().cross(zAxis).normalize()
              const yAxis = zAxis.clone().cross(xAxis).normalize()
              const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)
  
              setGizmoInfo({ productId, matrix })
            }
            else if (mesh.type === 'cone') {
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
  
              setGizmoInfo({ productId, matrix })
            }
            else {
              const zAxis = intersection.face?.normal.clone().normalize() || new THREE.Vector3(0, 0, 1)
              if (zAxis.dot(rayL.direction) > 0) {
                zAxis.negate()
              }
              const frontVec = zAxis.y !== 1 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
              const xAxis = frontVec.clone().cross(zAxis).normalize()
              const yAxis = zAxis.clone().cross(xAxis).normalize()
              const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pos)
  
              setGizmoInfo({ productId, matrix })
            }
          }
        }

      }

      const select = drawing.api.interaction.select
      const multi = e.shiftKey

      isPartMode && select(createInfo({
        objectId: drawing.geometry.cache[id].container.ownerId,
        graphicId: id,
        containerId: id,
        prodRefId: drawing.structure.currentProduct,
      }), multi)
      !isPartMode && select(createInfo({ objectId: id, prodRefId: id }), multi)
    }
  }, [drawingId])

  const onBackgroundClick = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    
    if (e.delta === 0) {
      const drawing = getDrawing(drawingId)
      drawing?.api.interaction.setSelected([])
      drawing?.api.selection?.unselectAll()
    }
  }, [drawingId])

  const selected = useDrawing(drawingId, d => d.interaction.selected)
  React.useEffect(() => {
    if ((!selected || selected.length === 0) && gizmoInfo) {
      setGizmoInfo(null)
    }
  }, [selected, gizmoInfo])
  
  return (
    <>
      <group ref={group} onPointerMove={onGeometryMove} onClick={onGeometryClick}>
        {children}
      </group>
      {gizmoInfo && <GizmoWrapper drawingId={drawingId} productId={gizmoInfo.productId} matrix={gizmoInfo.matrix} />}
      <background onPointerMove={onBackgroundMove} onClick={onBackgroundClick} />
    </>
  )
}
