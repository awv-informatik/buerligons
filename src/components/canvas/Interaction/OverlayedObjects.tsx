import React from 'react'

import { DrawingID, InteractionInfo, BuerliScope, GraphicType } from '@buerli.io/core'
import { useDrawing, GlobalTransform, Overlay } from '@buerli.io/react'

const getColor = (type: 'hovered' | 'selected', isSelActive: boolean) => {
  if (isSelActive) {
    return type === 'hovered' ? '#86d2ea' : '#957ab8'
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
  const solid = useDrawing(drawingId, d => d.geometry.cache[info.containerId || -1])
  const mesh = solid?.meshes.find(mesh_ => mesh_.graphicId === info.graphicId)
  const curve = !mesh ? solid?.map[info.graphicId || -1] : undefined  // If info.graphicId points to a mesh, force curve to undefined
  const point = solid?.points.find(pt => pt.graphicId === info.graphicId)

  const activeSel = useDrawing(drawingId, d => d.selection.refs[d.selection.active || -1])
  const color = getColor(type, Boolean(activeSel))
  const renderOrder = getRenderOrder(type)

  if (!info.graphicId || !info.containerId || !info.prodRefId) {
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
