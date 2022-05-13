import React from 'react'
import * as THREE from 'three'

import { useFrame } from '@react-three/fiber'
import { DrawingID, getDrawing, GeometryElement, ContainerGeometryT } from '@buerli.io/core'
import { CCClasses } from '@buerli.io/classcad'
import { Product, GlobalTransform, CameraHelper, Mesh, Entity } from '@buerli.io/react'
import { findObject, getMateRefIds, InteractionInfo, WorkPointObj, WorkAxisObj, WorkPlaneObj, WorkCoordSystemObj } from '@buerli.io/react-cad'

import { useOutlinesStore } from './OutlinesStore'

const pointSize = 0.6
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
    <mesh ref={ref} position={position} geometry={sphereGeom}>
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

const lineWidth = 0.25
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
    <mesh ref={ref} position={position} quaternion={quaternion} geometry={cylGeom}>
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

function useOutlinedObjects(drawingId: DrawingID, hovered: InteractionInfo) {
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
          <GlobalTransform key={hovered.objectId} drawingId={drawingId} objectId={hovered.productId}>
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
}

const OutlinedObject: React.FC<{ id: number }> = ({ children, id }) => {
  const setOutlinedMeshes = useOutlinesStore(s => s.setOutlinedMeshes)
  const removeMesh = useOutlinesStore(s => s.removeMesh)

  const groupRef = React.useRef<THREE.Group>(null!)

  React.useEffect(() => {
    const meshes_: THREE.Object3D[] = []

    groupRef.current?.traverse(o => {
      if (o.type === 'Mesh') {
        meshes_.push(o)
      }
    })

    setOutlinedMeshes(id, meshes_)

    return () => removeMesh(id)
  }, [children])

  return (
    <group ref={groupRef}>
      {children}
    </group>
  )
}

// This approach is somehow very prone to app freezing and crashing
/* export function OutlinedObjects({drawingId, hovered }: { drawingId: DrawingID, hovered: InteractionInfo }) {
  if (hovered?.type === 'AssemblyNode') {
    return (
      <OutlinedObject key={hovered.objectId} id={hovered.objectId}>
        <Product drawingId={drawingId} productId={hovered.objectId} isRoot />
      </OutlinedObject>
    )
  }

  if (hovered?.type === 'Constraint') {
    const mateRefIds = getMateRefIds(drawingId, hovered.objectId)
    return (
      <>
        {mateRefIds?.map(id => (
          <OutlinedObject key={id} id={id}>
            <Product drawingId={drawingId} productId={id} isRoot />
          </OutlinedObject>
        )) || null}
      </>
    )
  }

  if (hovered?.type === 'Feature') {
    const objClass = getDrawing(drawingId).structure.tree[hovered.objectId]?.class

    if (objClass === CCClasses.CCWorkPoint) {
      return (
        <OutlinedObject key={hovered.objectId} id={hovered.objectId}>
          <WorkPointObj drawingId={drawingId} objectId={hovered.objectId} opacity={0} />
        </OutlinedObject>
      )
    }

    if (objClass === CCClasses.CCWorkAxis) {
      return (
        <OutlinedObject key={hovered.objectId} id={hovered.objectId}>
          <WorkAxisObj drawingId={drawingId} objectId={hovered.objectId} opacity={0} />
        </OutlinedObject>
      )
    }

    if (objClass === CCClasses.CCWorkPlane) {
      return (
        <OutlinedObject key={hovered.objectId} id={hovered.objectId}>
          <WorkPlaneObj drawingId={drawingId} objectId={hovered.objectId} opacity={0} />
        </OutlinedObject>
      )
    }

    if (objClass === CCClasses.CCWorkCoordSystem) {
      return (
        <OutlinedObject key={hovered.objectId} id={hovered.objectId}>
          <WorkCoordSystemObj drawingId={drawingId} objectId={hovered.objectId} opacity={0} />
        </OutlinedObject>
      )
    }

    return null
  }

  if (hovered?.type === 'Solid' || hovered?.type === 'Graphic') {
    const geom = findObject(drawingId, hovered.objectId) as ContainerGeometryT | GeometryElement | undefined

    if ((geom as ContainerGeometryT)?.type === 'brep') {
      return (
        <OutlinedObject key={hovered.objectId} id={hovered.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={hovered.productId}>
            <Entity drawingId={drawingId} elem={geom as any} opacity={0} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    if ((geom as GeometryElement)?.type === 'plane' || (geom as GeometryElement)?.type === 'cylinder'|| (geom as GeometryElement)?.type === 'cone' || (geom as GeometryElement)?.type === 'nurbs') {
      return (
        <OutlinedObject key={hovered.objectId} id={hovered.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={hovered.productId}>
            <Mesh elem={geom as any} opacity={0} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    if ((geom as GeometryElement)?.type === 'line') {
      return (
        <OutlinedObject key={hovered.objectId} id={hovered.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={hovered.productId}>
            <LineMesh start={(geom as any).start} end={(geom as any).end} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    if ((geom as GeometryElement)?.type === 'point') {
      // TODO: not use buerli element? use a smaller point / mesh?
      return (
        <OutlinedObject key={hovered.objectId} id={hovered.objectId}>
          <GlobalTransform drawingId={drawingId} objectId={hovered.productId}>
            <Point elem={geom as any} opacity={0} />
          </GlobalTransform>
        </OutlinedObject>
      )
    }

    return null
  }

  return null
} */

export function OutlinedObjects({drawingId, hovered }: { drawingId: DrawingID, hovered: InteractionInfo }) {
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
}
