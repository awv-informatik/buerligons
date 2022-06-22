import React from 'react'
import * as THREE from 'three'

import { useThree, useFrame } from '@react-three/fiber'
import { DrawingID, getDrawing, GeometryElement, ContainerGeometryT, InteractionInfo, ObjectID } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { useDrawing, BuerliGeometry, GlobalTransform, CameraHelper, Overlay } from '@buerli.io/react'
import { findObject, getMateRefIds, WorkPointObj, WorkAxisObj, WorkPlaneObj, WorkCoordSystemObj, SelectedMateObj } from '@buerli.io/react-cad'

import { useOutlinesStore } from './OutlinesStore'

const pointSize = 1.0
const sphereGeom = new THREE.SphereGeometry(1, 12, 12)
const PointMesh: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
  const ref = React.useRef<THREE.Object3D>()
  useFrame(args => {
    if (ref.current) {
      const scale = CameraHelper.calculateScaleFactor(position, 7, args.camera, args.size)
      const newScale: [number, number, number] = [pointSize * scale, pointSize * scale, pointSize * scale]
      if (newScale.some((s, i) => s !== ref.current?.scale.getComponent(i))) {
        ref.current.scale.set(...newScale)
        args.invalidate()
      }
    }
  })

  return (
    <mesh ref={ref} position={position} geometry={sphereGeom} renderOrder={1000}>
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

const lineWidth = 0.5
const cylGeom = new THREE.CylinderGeometry(1, 1, 1, 6)
const LineMesh: React.FC<{
  start: THREE.Vector3
  end: THREE.Vector3
}> = ({ start, end }) => {

  const { position, quaternion } = React.useMemo(() => {
    const dir = end.clone().sub(start).normalize()

    return {
      position: new THREE.Vector3().lerpVectors(start, end, 0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    }
  }, [start, end])

  const ref = React.useRef<THREE.Object3D>()
  useFrame(args => {
    if (ref.current) {
      const scale = CameraHelper.calculateScaleFactor(position, 7, args.camera, args.size)
      const newScale: [number, number, number] = [lineWidth * scale, start.distanceTo(end), lineWidth * scale]
      if (newScale.some((s, i) => s !== ref.current?.scale.getComponent(i))) {
        ref.current.scale.set(...newScale)
        args.invalidate()
      }
    }
  })

  return (
    <mesh ref={ref} position={position} quaternion={quaternion} geometry={cylGeom} renderOrder={1000}>
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

class EdgeApproxCurve extends THREE.Curve<THREE.Vector3> {
  points: number[]
  size: number
  step: number

  constructor(points_: number[]) {
    super()

    this.points = points_
    this.size = points_.length / 3
    this.step = 1.0 / (this.size - 1)
  }

  getPoint(t: number, optionalTarget: THREE.Vector3 = new THREE.Vector3()) {
    const l = t / this.step
    const index = Math.floor(l)
    const k = l - index

    if (t >= 1.0) {
      return optionalTarget.set(
        this.points[this.points.length - 3],
        this.points[this.points.length - 2],
        this.points[this.points.length - 1],
      )
    }

    const tx = (1 - k) * this.points[index * 3] + k * this.points[(index + 1) * 3]
    const ty = (1 - k) * this.points[index * 3 + 1] + k * this.points[(index + 1) * 3 + 1]
    const tz = (1 - k) * this.points[index * 3 + 2] + k * this.points[(index + 1) * 3 + 2]

    return optionalTarget.set(tx, ty, tz)
  }
}

const edgeWidth = 0.5
const EdgeMesh: React.FC<{
  points: number[]
}> = ({ points }) => {
  const [scale, setScale] = React.useState<number>(1.0)
  
  useFrame(args => {
    const newScale = CameraHelper.calculateScaleFactor(new THREE.Vector3(points[0], points[1], points[2]), 7, args.camera, args.size)
    if (newScale !== scale) {
      setScale(newScale)
      args.invalidate()
    }
  })

  const { path, start, end } = React.useMemo(() => ({
    path: new EdgeApproxCurve(points),
    start: new THREE.Vector3(points[0], points[1], points[2]),
    end: new THREE.Vector3(points[points.length - 3], points[points.length - 2], points[points.length - 1]),
  }), [points])

  const { tubeGeometry, sphereGeometry } = React.useMemo(() => ({
    tubeGeometry: new THREE.TubeGeometry(path, points.length / 3, edgeWidth * scale, 6, false),
    sphereGeometry: new THREE.SphereGeometry(edgeWidth * scale, 12, 12),
  }), [path, points.length, scale])

  return (
    <>
      <mesh geometry={tubeGeometry} renderOrder={1000}>
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <mesh position={start} geometry={sphereGeometry} renderOrder={1000}>
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <mesh position={end} geometry={sphereGeometry} renderOrder={1000}>
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  )
}

const arcWidth = 0.5
const ArcMesh: React.FC<{
  center: THREE.Vector3
  xAxis: [number, number, number]
  zAxis: [number, number, number]
  radius: number
  angle: number
}> = ({ center, xAxis, zAxis, radius, angle }) => {
  const [scale, setScale] = React.useState<number>(1.0)
  
  useFrame(args => {
    const newScale = CameraHelper.calculateScaleFactor(center, 7, args.camera, args.size)
    if (newScale !== scale) {
      setScale(newScale)
      args.invalidate()
    }
  })

  const { quaternion, start, end } = React.useMemo(() => {
    const xAxisV = new THREE.Vector3(...xAxis)
    const zAxisV = new THREE.Vector3(...zAxis)
    const yAxisV = zAxisV.clone().cross(xAxisV).normalize()
    const rotationMatrix = new THREE.Matrix4().makeBasis(xAxisV, yAxisV, zAxisV)

    const startL = new THREE.Vector3(radius, 0.0, 0.0)
    const endL = new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0.0)

    return {
      quaternion: new THREE.Quaternion().setFromRotationMatrix(rotationMatrix),
      start: center.clone().add(startL.applyMatrix4(rotationMatrix)),
      end: center.clone().add(endL.applyMatrix4(rotationMatrix)),
    }
  }, [center, xAxis, zAxis, radius, angle])

  const { torusGeometry, sphereGeometry } = React.useMemo(() => ({
    torusGeometry: new THREE.TorusGeometry(radius, arcWidth * scale, 6, 60, angle),
    sphereGeometry: new THREE.SphereGeometry(arcWidth * scale, 12, 12),
  }), [radius, angle, scale])

  return (
    <>
      <mesh position={center} quaternion={quaternion} geometry={torusGeometry}>
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <mesh position={start} geometry={sphereGeometry} renderOrder={1000}>
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <mesh position={end} geometry={sphereGeometry} renderOrder={1000}>
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  )
}

const circleWidth = 0.5
const CircleMesh: React.FC<{
  center: THREE.Vector3
  xAxis: [number, number, number]
  zAxis: [number, number, number]
  radius: number
}> = ({ center, xAxis, zAxis, radius }) => {
  const [scale, setScale] = React.useState<number>(1.0)
  
  useFrame(args => {
    const newScale = CameraHelper.calculateScaleFactor(center, 7, args.camera, args.size)
    if (newScale !== scale) {
      setScale(newScale)
      args.invalidate()
    }
  })

  const quaternion = React.useMemo(() => {
    const xAxisV = new THREE.Vector3(...xAxis)
    const zAxisV = new THREE.Vector3(...zAxis)
    const yAxisV = zAxisV.clone().cross(xAxisV).normalize()
    const rotationMatrix = new THREE.Matrix4().makeBasis(xAxisV, yAxisV, zAxisV)

    return new THREE.Quaternion().setFromRotationMatrix(rotationMatrix)
  }, [xAxis, zAxis])

  const torusGeometry = React.useMemo(() => {
    return new THREE.TorusGeometry(radius, circleWidth * scale, 6, 60)
  }, [radius, scale])

  return (
    <mesh position={center} quaternion={quaternion} geometry={torusGeometry}>
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

/* function useOutlinedObjects(drawingId: DrawingID, hovered: InteractionInfo) {
  const outlinedObjects = React.useMemo(() => {
    switch(hovered?.type) {
      case 'AssemblyNode': {
        return [(<Product key={hovered.objectId} drawingId={drawingId} productId={hovered.objectId} isRoot />)]
      }
      case 'Constraint': {
        const mateRefIds = getMateRefIds(drawingId, hovered.objectId)
        return mateRefIds?.map(id => (<Product key={id} drawingId={drawingId} productId={id} isRoot />)) || []
      }
      case 'Feature': {
        const objClass = getDrawing(drawingId).structure.tree[hovered.objectId]?.class

        switch (objClass) {
          case CCClasses.CCWorkPoint: {
            return [(<WorkPointObj key={hovered.objectId} drawingId={drawingId} objectId={hovered.objectId} opacity={0} />)]
          }
          case CCClasses.CCWorkAxis: {
            return [(<WorkAxisObj key={hovered.objectId} drawingId={drawingId} objectId={hovered.objectId} opacity={0} />)]
          }
          case CCClasses.CCWorkPlane: {
            return [(<WorkPlaneObj key={hovered.objectId} drawingId={drawingId} objectId={hovered.objectId} opacity={0} />)]
          }
          case CCClasses.CCWorkCoordSystem: {
            return [(<WorkCoordSystemObj key={hovered.objectId} drawingId={drawingId} objectId={hovered.objectId} opacity={0} />)]
          }
        }

        return []
      }
      case 'Solid':
      case 'Graphic': {
        const geom = findObject(drawingId, hovered.objectId) as ContainerGeometryT | GeometryElement | undefined
        return [(
          <GlobalTransform key={hovered.objectId} drawingId={drawingId} objectId={hovered.prodRefId as ObjectID}>
            {(geom as ContainerGeometryT)?.type === 'brep' && (
              <Entity drawingId={drawingId} elem={geom as any} opacity={0} />
            )}
            {((geom as GeometryElement)?.type === 'plane' || (geom as GeometryElement)?.type === 'cylinder'|| (geom as GeometryElement)?.type === 'cone' || (geom as GeometryElement)?.type === 'nurbs') && (
              <Mesh elem={geom as any} opacity={0} />
            )}
            {(geom as GeometryElement)?.type === 'line' && (
              <LineMesh start={(geom as any).start} end={(geom as any).end} />
            )}
            {(geom as GeometryElement)?.type === 'point' && (
              <PointMesh position={(geom as any).position} />
            )}
          </GlobalTransform>
        )]
      }
    }
  
    return []
  }, [drawingId, hovered])

  return outlinedObjects
} */

const OutlinedObject: React.FC<{ group: string, id: number }> = ({ children, group, id }) => {
  const outlinedMeshes = useOutlinesStore(s => s.outlinedMeshes)
  const setOutlinedMeshes = useOutlinesStore(s => s.setOutlinedMeshes)
  const removeMesh = useOutlinesStore(s => s.removeMesh)

  const groupRef = React.useRef<THREE.Group>(null!)

  useFrame(() => {
    if (!outlinedMeshes[group]?.[id] && groupRef.current) {
      const meshes_: THREE.Object3D[] = []
  
      groupRef.current.traverse(o => {
        if (o.type === 'Mesh') {
          meshes_.push(o)
        }
      })
  
      setOutlinedMeshes(group, id, meshes_)
    }
  })

  React.useEffect(() => {
    return () => removeMesh(group, id)
  }, [])

  return (
    <group ref={groupRef}>
      {children}
    </group>
  )
}

const OutlinedProduct: React.FC<{ group: string, id: number }> = ({ group, id }) => {
  const { scene } = useThree()
  
  const outlinedMeshes = useOutlinesStore(s => s.outlinedMeshes)
  const setOutlinedMeshes = useOutlinesStore(s => s.setOutlinedMeshes)
  const removeMesh = useOutlinesStore(s => s.removeMesh)

  useFrame(() => {
    if (!outlinedMeshes[group]?.[id]) {
      const obj = scene?.getObjectByName(id.toString())
      const meshes_: THREE.Object3D[] = []
  
      obj?.traverse(o => {
        if (o.type === 'Mesh') {
          meshes_.push(o)
        }
      })
  
      setOutlinedMeshes(group, id, meshes_)
    }
  })

  React.useEffect(() => {
    return () => removeMesh(group, id)
  }, [])

  return null
}

export function OutlinedObjects({ drawingId, info, group }: { drawingId: DrawingID, info: InteractionInfo, group: string }) {
  const objClass = useDrawing(drawingId, d => d.structure.tree[info.objectId]?.class)

  if (objClass) {
    // Assembly node
    if (ccUtils.base.isA(objClass, CCClasses.IProductReference)) {
      return (
        <OutlinedProduct key={info.objectId} group={group} id={info.objectId} />
      )
    }
  
    // Constraint
    if (ccUtils.base.isA(objClass, CCClasses.CCHLConstraint)) {
      const mateRefIds = getMateRefIds(drawingId, info.objectId)
      return (
        <>
          {mateRefIds?.map(id => (
            <OutlinedProduct key={id} group={group} id={id} />
          )) || null}
        </>
      )
    }
  
    // Feature
    if (objClass === CCClasses.CCWorkPoint) {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <WorkPointObj drawingId={drawingId} objectId={info.objectId} opacity={0} />
        </OutlinedObject>
      )
    }
  
    if (objClass === CCClasses.CCWorkAxis) {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <WorkAxisObj drawingId={drawingId} objectId={info.objectId} opacity={0} />
        </OutlinedObject>
      )
    }
  
    if (objClass === CCClasses.CCWorkPlane) {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <WorkPlaneObj drawingId={drawingId} objectId={info.objectId} opacity={0} />
        </OutlinedObject>
      )
    }
  
    if (objClass === CCClasses.CCWorkCoordSystem) {
      // If there is a userData in info, we actually have to outline a mate...
      if (info.userData) {
        return (
          <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
            <SelectedMateObj
              drawingId={drawingId}
              csysId={info.userData.csys.id}
              matePath={info.userData.matePath}
              flip={info.userData.flip}
              reoriented={info.userData.reoriented}
              opacity={0}
            />
          </OutlinedObject>
        )
      }
      // Otherwise - a simple WorkCoordSystem
      else {
        return (
          <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
            <WorkCoordSystemObj drawingId={drawingId} objectId={info.objectId} opacity={0} />
          </OutlinedObject>
        )
      }
    }
  }
  else if (info.graphicId && info.prodRefId) {
    const geom = findObject(drawingId, info.graphicId) as ContainerGeometryT | GeometryElement | undefined

    // Solid
    if ((geom as ContainerGeometryT)?.type === 'brep') {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
            <Overlay.Entity drawingId={drawingId} elem={geom as any} opacity={0} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    // Mesh
    if ((geom as GeometryElement)?.type === 'plane' || (geom as GeometryElement)?.type === 'cylinder'|| (geom as GeometryElement)?.type === 'cone' || (geom as GeometryElement)?.type === 'nurbs') {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
            <Overlay.Mesh elem={geom as any} opacity={0} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    // Line
    if ((geom as GeometryElement)?.type === 'line') {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
            <LineMesh start={(geom as any).start} end={(geom as any).end} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    // Edge
    if ((geom as GeometryElement)?.type === 'edge') {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
            <EdgeMesh points={(geom as any).rawGraphic.points} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    // Arc
    if ((geom as GeometryElement)?.type === 'arc') {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
            <ArcMesh center={(geom as any).center} xAxis={(geom as any).rawGraphic.xAxis} zAxis={(geom as any).rawGraphic.zAxis} radius={(geom as any).radius} angle={(geom as any).angle} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    // Circle
    if ((geom as GeometryElement)?.type === 'circle') {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
            <CircleMesh center={(geom as any).center} xAxis={(geom as any).rawGraphic.xAxis} zAxis={(geom as any).rawGraphic.zAxis} radius={(geom as any).radius} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    // Point
    if ((geom as GeometryElement)?.type === 'point') {
      // TODO: not use buerli element? use a smaller point / mesh?
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
            <PointMesh position={(geom as any).position} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }
  }

  return null
}

/* export function OutlinedObjects({drawingId, hovered }: { drawingId: DrawingID, hovered: InteractionInfo }) {
  const outlinedObjects = useOutlinedObjects(drawingId, hovered)
  const id = hovered?.objectId || 0

  return (
    <>
      {outlinedObjects.map((obj, i) => (
        <OutlinedObject key={id + i} id={id + i}>
          {obj}
        </OutlinedObject>
      ))}
    </>
  )
} */
