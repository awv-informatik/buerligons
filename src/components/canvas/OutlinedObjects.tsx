import React from 'react'
import * as THREE from 'three'

import { useThree, useFrame } from '@react-three/fiber'
import { DrawingID, getDrawing, GeometryElement, ContainerGeometryT, InteractionInfo } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { useDrawing, GlobalTransform, CameraHelper, Overlay } from '@buerli.io/react'
import { getMateRefIds, WorkPointObj, WorkAxisObj, WorkPlaneObj, WorkCoordSystemObj, SelectedMateObj } from '@buerli.io/react-cad'

import { useOutlinesStore } from './OutlinesStore'

const transparentMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })

const pointSize = 1.0
const sphereGeom = new THREE.SphereGeometry(1, 12, 12)
const PointMesh: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
  const ref = React.useRef<THREE.Mesh>(null!)
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
    <mesh ref={ref} position={position} geometry={sphereGeom} material={transparentMaterial} renderOrder={1000} />
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

  const ref = React.useRef<THREE.Mesh>(null!)
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
    <mesh ref={ref} position={position} quaternion={quaternion} geometry={cylGeom} material={transparentMaterial} renderOrder={1000} />
  )
}

class EdgeApproxCurve extends THREE.Curve<THREE.Vector3> {
  points: number[]
  step: number

  constructor(points_: number[]) {
    super()

    this.points = points_
    this.step = 1.0 / (points_.length / 3 - 1)
  }

  override getPoint(t: number, optionalTarget: THREE.Vector3 = new THREE.Vector3()) {
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
      <mesh geometry={tubeGeometry} material={transparentMaterial} renderOrder={1000} />
      <mesh position={start} geometry={sphereGeometry} material={transparentMaterial} renderOrder={1000} />
      <mesh position={end} geometry={sphereGeometry} material={transparentMaterial} renderOrder={1000} />
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
      <mesh position={center} quaternion={quaternion} geometry={torusGeometry} material={transparentMaterial} renderOrder={1000} />
      <mesh position={start} geometry={sphereGeometry} material={transparentMaterial} renderOrder={1000} />
      <mesh position={end} geometry={sphereGeometry} material={transparentMaterial} renderOrder={1000} />
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
    <mesh position={center} quaternion={quaternion} geometry={torusGeometry} material={transparentMaterial} renderOrder={1000} />
  )
}

const OutlinedObject: React.FC<{ group: string, id: number; children?: React.ReactNode }> = ({ children, group, id }) => {
  const outlinedMeshes = useOutlinesStore(s => s.outlinedMeshes)
  const setOutlinedMeshes = useOutlinesStore(s => s.setOutlinedMeshes)
  const removeMesh = useOutlinesStore(s => s.removeMesh)

  const groupRef = React.useRef<THREE.Group>(null!)

  React.useEffect(() => {
    if (!outlinedMeshes[group]?.[id] && groupRef.current) {
      const meshes_: THREE.Object3D[] = []
  
      groupRef.current.traverse(o => {
        if (o.type === 'Mesh') {
          meshes_.push(o)
        }
      })
  
      setOutlinedMeshes(group, id, meshes_)
    }
  }, [group, id, outlinedMeshes, setOutlinedMeshes, children])

  React.useEffect(() => {
    return () => removeMesh(group, id)
  }, [group, id, removeMesh])

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

  React.useEffect(() => {
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
  }, [group, id, outlinedMeshes, setOutlinedMeshes, scene])

  React.useEffect(() => {
    return () => removeMesh(group, id)
  }, [group, id, removeMesh])

  return null
}

export function OutlinedObjects({ drawingId, info, group }: { drawingId: DrawingID, info: InteractionInfo, group: string }) {
  const objClass = useDrawing(drawingId, d => d.structure.tree[info.objectId]?.class)

  if (objClass && !info.graphicId) {
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
    if (ccUtils.base.isA(objClass, CCClasses.CCWorkPoint)) {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <WorkPointObj drawingId={drawingId} objectId={info.objectId} opacity={0} />
        </OutlinedObject>
      )
    }
  
    if (ccUtils.base.isA(objClass, CCClasses.CCWorkAxis)) {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <WorkAxisObj drawingId={drawingId} objectId={info.objectId} opacity={0} />
        </OutlinedObject>
      )
    }
  
    if (ccUtils.base.isA(objClass, CCClasses.CCWorkPlane)) {
      return (
        <OutlinedObject key={info.objectId} group={group} id={info.objectId}>
          <WorkPlaneObj drawingId={drawingId} objectId={info.objectId} opacity={0} />
        </OutlinedObject>
      )
    }
  
    if (ccUtils.base.isA(objClass, CCClasses.CCWorkCoordSystem)) {
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
  else if (info.graphicId && info.prodRefId && info.containerId) {
    const cache = getDrawing(drawingId).geometry.cache
    const geom = 
      cache[info.graphicId] as ContainerGeometryT | undefined ||
      cache[info.containerId]?.map[info.graphicId] as GeometryElement | undefined ||
      cache[info.containerId]?.points.find(pt => pt.graphicId === info.graphicId) as GeometryElement | undefined

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
