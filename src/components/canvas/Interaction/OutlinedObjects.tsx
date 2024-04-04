import React from 'react'
import * as THREE from 'three'

import { useThree } from '@react-three/fiber'
import { DrawingID, InteractionInfo, BuerliScope, getDrawing } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { useDrawing, GlobalTransform, Overlay } from '@buerli.io/react'
import { TreeObjScope, getMateRefIds } from '@buerli.io/react-cad'

import { useOutlinesStore } from './OutlinesStore'
import { getDescendants } from './ContextMenu/utils'

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

  const curInstanceChildren = useDrawing(drawingId, d => d.structure.tree[d.structure.currentInstance || -1]?.children)
  // Hovering an instance in the View and selection / node list is different.
  // In the View, a correct instance has to be derived from the graphic's prodRefId.
  // Elsewhere, it should match info.objectId.
  const tree = getDrawing(drawingId).structure.tree
  let instanceId = -1
  if (info.graphicId && info.prodRefId) {
    instanceId = curInstanceChildren?.find(id => id === info.prodRefId || getDescendants(drawingId, id).some(descId => descId === info.prodRefId)) || -1
  }
  else {
    // TODO: finalize the html-related hover
    // instanceId = curInstanceChildren?.find(id => info.objectId === (tree[id].members?.productRef?.value || id)) || -1
    instanceId = curInstanceChildren?.find(id => id === info.objectId || getDescendants(drawingId, id).some(descId => descId === info.objectId)) || -1
  }
  const instance = useDrawing(drawingId, d => d.structure.tree[instanceId])

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

  if (instance && activeSel?.isSelectable(TreeObjScope, { object: instance })) {
    // Assembly node
    return <OutlinedProduct key={instanceId} group={group} id={instanceId} />
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
