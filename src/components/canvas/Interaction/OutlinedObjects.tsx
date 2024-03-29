import React from 'react'
import * as THREE from 'three'

import { useThree } from '@react-three/fiber'
import { DrawingID, InteractionInfo, BuerliScope } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { useDrawing, GlobalTransform, Overlay } from '@buerli.io/react'
import { getMateRefIds } from '@buerli.io/react-cad'

import { useOutlinesStore } from './OutlinesStore'

const OutlinedObject: React.FC<{ group: string; id: number; children?: React.ReactNode }> = ({
  children,
  group,
  id,
}) => {
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

  return <group ref={groupRef}>{children}</group>
}

const OutlinedProduct: React.FC<{ group: string; id: number }> = ({ group, id }) => {
  const { scene } = useThree()

  const outlinedMeshes = useOutlinesStore(s => s.outlinedMeshes)
  const setOutlinedMeshes = useOutlinesStore(s => s.setOutlinedMeshes)
  const removeMesh = useOutlinesStore(s => s.removeMesh)

  React.useEffect(() => {
    if (!outlinedMeshes[group]?.[id]) {
      let obj: THREE.Object3D | undefined
      scene?.traverse(sceneObj => {
        if (!obj && sceneObj.userData?.id === id) {
          obj = sceneObj
        }
      })

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

export function OutlinedObjects({
  drawingId,
  info,
  group,
}: {
  drawingId: DrawingID
  info: InteractionInfo
  group: string
}) {
  const solid = useDrawing(drawingId, d => d.geometry.cache[info.containerId || -1])
  const mesh = solid?.meshes.find(mesh_ => mesh_.graphicId === info.graphicId)
  const solidColor = solid?.color || '#808080'

  const activeSel = useDrawing(drawingId, d => d.selection.refs[d.selection.active || -1])
  const prodClass = useDrawing(drawingId, d => d.structure.tree[d.structure.currentProduct || -1]?.class) || ''
  const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

  const objClass = useDrawing(drawingId, d => d.structure.tree[info.objectId]?.class) || ''
  const prodRefClass = useDrawing(drawingId, d => d.structure.tree[info.prodRefId || -1]?.class) || ''

  if (!activeSel && !isPartMode && ccUtils.base.isA(objClass, CCClasses.CCHLConstraint)) {
    // Constraint
    const mateRefIds = getMateRefIds(drawingId, info.objectId)
    return <>{mateRefIds?.map(id => <OutlinedProduct key={id} group={group} id={id} />) || null}</>
  }

  if (!info.prodRefId) {
    return null
  }

  if (!activeSel && !isPartMode && ccUtils.base.isA(prodRefClass, CCClasses.IProductReference)) {
    // Assembly node with hovered / selected mesh (if it exists)
    return (
      <>
        <OutlinedProduct key={info.prodRefId} group={group} id={info.prodRefId} />
        {mesh && (
          <OutlinedObject key={mesh.graphicId} group={group} id={mesh.graphicId}>
            <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
              <Overlay.Mesh elem={mesh as any} color={solidColor} opacity={0} />
            </GlobalTransform>
          </OutlinedObject>
        )}
      </>
    )
  }

  if (!activeSel && isPartMode && solid) {
    // Solid with hovered / selected mesh (if it exists)
    return (
      <>
        <OutlinedObject key={solid.graphicId} group={group} id={solid.graphicId}>
          <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
            <Overlay.Entity drawingId={drawingId} elem={solid as any} color={solidColor} opacity={0} />
          </GlobalTransform>
        </OutlinedObject>
        {mesh && (
          <OutlinedObject key={mesh.graphicId} group={group} id={mesh.graphicId}>
            <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
              <Overlay.Mesh elem={mesh as any} color={solidColor} opacity={0} />
            </GlobalTransform>
          </OutlinedObject>
        )}
      </>
    )
  }

  if (solid && activeSel?.isSelectable(BuerliScope, solid.type)) {
    // Solid
    return (
      <OutlinedObject key={solid.graphicId} group={group} id={solid.graphicId}>
        <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
          <Overlay.Entity drawingId={drawingId} elem={solid as any} color={solidColor} opacity={0} />
        </GlobalTransform>
      </OutlinedObject>
    )
  }

  if (mesh && activeSel?.isSelectable(BuerliScope, mesh.type)) {
    // Mesh
    return (
      <OutlinedObject key={mesh.graphicId} group={group} id={mesh.graphicId}>
        <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
          <Overlay.Mesh elem={mesh as any} color={solidColor} opacity={0} />
        </GlobalTransform>
      </OutlinedObject>
    )
  }

  return null
}
