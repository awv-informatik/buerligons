import React from 'react'

import { DrawingID, InteractionInfo, BuerliScope, GraphicType } from '@buerli.io/core'
import { CCClasses } from '@buerli.io/classcad'
import { useDrawing, GlobalTransform, Overlay } from '@buerli.io/react'
import { HUD, WorkPointObj, WorkAxisObj, WorkPlaneObj, WorkCoordSystemObj } from '@buerli.io/react-cad'

const getColor = (type: 'hovered' | 'selected', isSelActive: boolean) => {
  if (isSelActive) {
    return type === 'hovered' ? '#3280ff' : '#8040c0'
  } else {
    return type === 'hovered' ? 'green' : 'red'
  }
}

const getRenderOrder = (type: 'hovered' | 'selected') => {
  return type === 'hovered' ? 501 : 500
}

export function OverlayedObjects({
  drawingId,
  info,
  type,
}: {
  drawingId: DrawingID
  info: InteractionInfo
  type: 'hovered' | 'selected'
}) {
  const object = useDrawing(drawingId, d => d.structure.tree[info.objectId])
  const isVisible = useDrawing(drawingId, d => d.plugin.visible.indexOf(info.objectId) !== -1) || false

  const solid = useDrawing(drawingId, d => d.geometry.cache[info.containerId || -1])
  const mesh = solid?.meshes.find(mesh_ => mesh_.graphicId === info.graphicId)
  const curve = !mesh ? solid?.map[info.graphicId || -1] : undefined  // If info.graphicId points to a mesh, force curve to undefined
  const point = solid?.points.find(pt => pt.graphicId === info.graphicId)

  const activeSel = useDrawing(drawingId, d => d.selection.refs[d.selection.active || -1])
  const color = getColor(type, Boolean(activeSel))
  const renderOrder = getRenderOrder(type)

  if (!info.prodRefId) {
    return null
  }

  if (object?.class === CCClasses.CCWorkPoint && !isVisible) {
    return (
      <HUD>
        <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
          <WorkPointObj drawingId={drawingId} objectId={info.objectId} color={color} />
        </GlobalTransform>
      </HUD>
    )
  }

  if (object?.class === CCClasses.CCWorkAxis && !isVisible) {
    return (
      <HUD>
        <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
          <WorkAxisObj drawingId={drawingId} objectId={info.objectId} color={color} />
        </GlobalTransform>
      </HUD>
    )
  }

  if (object?.class === CCClasses.CCWorkPlane && !isVisible) {
    return (
      <HUD>
        <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
          <WorkPlaneObj drawingId={drawingId} objectId={info.objectId} color={color} opacity={0.3} />
        </GlobalTransform>
      </HUD>
    )
  }

  if (object?.class === CCClasses.CCWorkCoordSystem && !isVisible) {
    return (
      <HUD>
        <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
          <WorkCoordSystemObj drawingId={drawingId} objectId={info.objectId} color={color} />
        </GlobalTransform>
      </HUD>
    )
  }

  if (!info.graphicId || !info.containerId) {
    return null
  }

  // Mesh
  if (solid && mesh && activeSel?.isSelectable(BuerliScope, GraphicType.LOOP)) {
    return (
      <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
        {mesh.loops.flat().map(id => <Overlay.Spline key={id} elem={(solid.map[id] as any)} color={color} renderOrder={renderOrder} lineWidth={3} />)}
      </GlobalTransform>
    )
  }
  
  // For now, only highlight meshes if no selection is active. For selection, only outlining is used...
  if (mesh && !activeSel) {
    return (
      <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
        <Overlay.Mesh elem={mesh as any} color={color} opacity={0.5} renderOrder={renderOrder} />
      </GlobalTransform>
    )
  }

  // Line / Edge / Arc / Circle
  if (curve && (!activeSel || activeSel?.isSelectable(BuerliScope, curve.type))) {
    return (
      <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
        <Overlay.Spline elem={(curve as any)} color={color} renderOrder={renderOrder} lineWidth={3} />
      </GlobalTransform>
    )
  }

  // Point
  if (point && (!activeSel || activeSel?.isSelectable(BuerliScope, point.type))) {
    return (
      <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
        <Overlay.Point elem={(point as any)} color={color} renderOrder={renderOrder} pointSize={6} />
      </GlobalTransform>
    )
  }

  return null
}
