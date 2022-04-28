import React from 'react'
import * as THREE from 'three'
import create from 'zustand'

import { EffectComposer, Outline, SSAO } from '@react-three/postprocessing'
import { ObjectID, DrawingID, getPlugin, GeometryElement, ContainerGeometryT } from '@buerli.io/core'
import { CCClasses } from '@buerli.io/classcad'
import { useBuerli, Product, GlobalTransform, Point, Mesh, Entity, Plugin } from '@buerli.io/react'
import { findObject, getMateRefIds, InteractionInfo } from '@buerli.io/react-cad'

import { AutoClear } from '../../components'

const useOutlinesStore = create<{
  outlinedMeshes: { [key: number]: THREE.Object3D[]}
  setOutlinedMeshes: (id: ObjectID, outlinedMeshes: THREE.Object3D[]) => void
  removeMesh: (id: ObjectID) => void
}>((set, get) => ({
  outlinedMeshes: {},
  setOutlinedMeshes: (id: ObjectID, outlinedMeshes_: THREE.Object3D[]) =>
    set(state => ({ outlinedMeshes: { ...state.outlinedMeshes, [id]: outlinedMeshes_ } })),
  removeMesh: (id: ObjectID) =>
    set(state => {
      const outlinedMeshes_ = { ...state.outlinedMeshes }
      delete outlinedMeshes_[id]
      return { outlinedMeshes: outlinedMeshes_ }
    }),
}))

function useOutlinedObjects(drawingId: DrawingID, hovered: InteractionInfo) {
  const outlinedObjects = React.useMemo(() => {
    switch(hovered?.type) {
      case 'AssemblyNode': {
        return [(<Product drawingId={drawingId} productId={hovered.objectId} isRoot />)]
      }
      case 'Constraint': {
        const mateRefIds = getMateRefIds(drawingId, hovered.objectId)
        return mateRefIds?.map(id => (<Product drawingId={drawingId} productId={id} isRoot />)) || []
      }
      case 'Feature': {
        return [(<Plugin drawingId={drawingId} pluginId={hovered.objectId} view />)]
      }
      case 'Solid':
      case 'Graphic': {
        const geom = findObject(drawingId, hovered.objectId) as ContainerGeometryT | GeometryElement | undefined
        return [(
          <GlobalTransform drawingId={drawingId} objectId={hovered.productId}>
            {(geom as ContainerGeometryT)?.type === 'brep' && (
              <Entity drawingId={drawingId} elem={geom as any} opacity={0} />
            )}
            {((geom as GeometryElement)?.type === 'plane' || (geom as GeometryElement)?.type === 'cylinder'|| (geom as GeometryElement)?.type === 'cone' || (geom as GeometryElement)?.type === 'nurbs') && (
              <Mesh elem={geom as any} opacity={0} />
            )}
            {(geom as GeometryElement)?.type === 'line' && (
              <lineSegments geometry={(geom as GeometryElement).geometry as THREE.BufferGeometry} renderOrder={100}>
                <lineBasicMaterial transparent opacity={0} />
              </lineSegments>
            )}
            {(geom as GeometryElement)?.type === 'point' && (
              /* TODO: not use buerli element? use a smaller point / mesh? */
              <Point elem={geom as any} opacity={0} />
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
      if (o.type === 'Mesh' || o.type === 'LineSegments') {
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

function OutlinedObjects({drawingId, hovered }: { drawingId: DrawingID, hovered: InteractionInfo }) {
  const outlinedObjects = useOutlinedObjects(drawingId, hovered)
  const id = hovered?.objectId || 0

  return (
    <>
      {outlinedObjects.map((obj, i) => (
        <OutlinedObject key={i} id={id + i}>
          {obj}
        </OutlinedObject>
      ))}
    </>
  )
}

export function Composer({
  children,
  drawingId,
  hovered,
  xRay = true,
  blur = true,
  color = 'white',
  hiddenColor = undefined,
  edgeStrength = 100,
  width = 1000,
  radius = 0.1,
  blendFunction = 2,
  ...props
}: any) {
  const outlinedMeshes = useOutlinesStore(s => s.outlinedMeshes)

  // Skip outlines when selection is active
  // const selectionActive = useBuerli(s => !!s.drawing.refs[s.drawing.active!]?.selection.active)
  // Skip AO when sketch is active
  const sketchActive = useBuerli(s => {
    const drawing = s.drawing.refs[s.drawing.active!]
    const plugin = drawing?.plugin.refs[drawing?.plugin.active.feature!]
    return drawing?.structure.tree[plugin?.id]?.class === CCClasses.CCSketch ?? false
  })

  // Decide if effects-chain is active or not
  const enabled = !sketchActive

  return (
    <>
      <EffectComposer enabled={enabled} multisampling={8} autoClear={false} {...props}>
        <SSAO radius={radius} intensity={85} luminanceInfluence={0.2} color="black" />
        {Object.values(outlinedMeshes).map((meshes, i) => (
          <Outline
            key={i}
            selection={meshes}
            selectionLayer={10 + i}
            blendFunction={blendFunction}
            xRay={xRay}
            blur={blur}
            hiddenEdgeColor={color as any}
            visibleEdgeColor={color as any}
            edgeStrength={edgeStrength}
            width={width}
          />
        ))}
      </EffectComposer>
      <OutlinedObjects drawingId={drawingId} hovered={hovered} />
      {!enabled && <AutoClear />}
      {children}
    </>
  )
}
