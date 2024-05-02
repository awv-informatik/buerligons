import React from 'react'
import * as THREE from 'three'

import { DrawingID, InteractionInfo, BuerliScope, GraphicType } from '@buerli.io/core'
import { ccUtils, CCClasses } from '@buerli.io/classcad'
import { useDrawing, GlobalTransform, Overlay } from '@buerli.io/react'
import { HUD, WorkPointObj, WorkAxisObj, WorkPlaneObj, WorkCoordSystemObj, WorkCSysObj, CompositeCurveObj } from '@buerli.io/react-cad'

const getColor = (type: 'hovered' | 'selected', isSelActive: boolean, solidColor: THREE.Color | undefined) => {
  const gHoveredColors = [new THREE.Color('#008000'), new THREE.Color('#00ff00')]
  const gSelectedColors = [new THREE.Color('#ff0000'), new THREE.Color('#ffa000')]
  const sHoveredColors = [new THREE.Color('#3280ff'), new THREE.Color('#194080')]
  const sSelectedColors = [new THREE.Color('#8040c0'), new THREE.Color('#402060')]

  let colors: THREE.Color[]
  if (isSelActive) {
    colors = type === 'hovered' ? sHoveredColors : sSelectedColors
  } else {
    colors = type === 'hovered' ? gHoveredColors : gSelectedColors
  }

  if (!solidColor) {
    return colors[0]
  }

  const { r: rO, g: gO, b: bO } = colors[0]
  const { r: rS, g: gS, b: bS } = solidColor

  const diff = 2 * Math.abs(rO - rS) + 2 * Math.abs(gO - gS) + 3 * Math.abs(bO - bS) // weighted difference
  if (diff < 0.5) {
    return colors[1]
  }

  return colors[0]
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
  const solidColor = solid?.color

  const activeSel = useDrawing(drawingId, d => d.selection.refs[d.selection.active || -1])
  const color = getColor(type, Boolean(activeSel), solidColor)
  const renderOrder = getRenderOrder(type)
  
  const prodClass = useDrawing(drawingId, d => d.structure.tree[d.structure.currentProduct || -1]?.class) || ''
  const isPartMode = ccUtils.base.isA(prodClass, CCClasses.CCPart)

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

  // At least for now ignore WorkCoordSystems in assembly mode (i.e. Mates). CSysDisplay is supposed to fully handle their visualization...
  if (object?.class === CCClasses.CCWorkCoordSystem && !isVisible && isPartMode) {
    return (
      <HUD>
        <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
          <WorkCoordSystemObj drawingId={drawingId} objectId={info.objectId} color={color} />
        </GlobalTransform>
      </HUD>
    )
  }

  if (object?.class === CCClasses.CCWorkCSys && !isVisible && isPartMode) {
    return (
      <HUD>
        <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
          <WorkCSysObj drawingId={drawingId} objectId={info.objectId} color={color} />
        </GlobalTransform>
      </HUD>
    )
  }

  if (object?.class === CCClasses.CCCompositeCurve && !isVisible && isPartMode) {
    return (
      <HUD>
        <GlobalTransform drawingId={drawingId} objectId={info.prodRefId}>
          <CompositeCurveObj drawingId={drawingId} objectId={info.objectId} color={color} />
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
        {mesh.loops.flat().map(id => <Overlay.Spline key={id} elem={(solid.map[id] as any)} color={color} renderOrder={renderOrder} lineWidth={5} />)}
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
        <Overlay.Spline elem={(curve as any)} color={color} renderOrder={renderOrder} lineWidth={5} />
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
