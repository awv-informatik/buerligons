/* eslint-disable react/display-name */
import React from 'react'

import { DrawingID, InteractionInfo } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'

import { OutlinedObjects } from './OutlinedObjects'
import { convertSelToInteraction } from './utils'
import { OverlayedObjects } from './OverlayedObjects'

const useHovered = (drawingId: DrawingID) => {
  return useDrawing(drawingId, d => d.interaction.hovered) as InteractionInfo | null
}

const useSelected = (drawingId: DrawingID) => {
  const interactionSel = useDrawing(drawingId, d => d.interaction.selected) as InteractionInfo[]
  const interactionHov = useHovered(drawingId)

  const isSelActive = useDrawing(drawingId, d => d.selection.active !== null) || false
  const selectionItems = useDrawing(drawingId, d => d.selection.refs[d.selection.active || '']?.items)
  const selectionInfo = convertSelToInteraction(drawingId, selectionItems || [])
  const selected = isSelActive ? selectionInfo : interactionSel

  // Remove currently hovered items from selected to avoid rendering 2 semi-transparent overlays at once right after the selection
  return selected.filter(info => info.uniqueIdent !== interactionHov?.uniqueIdent)
}

export function HighlightedObjects({ drawingId }: { drawingId: DrawingID }) {
  const hovered = useHovered(drawingId)
  const selected = useSelected(drawingId)

  return (
    <>
      {hovered && (
        <React.Fragment key={hovered.uniqueIdent + 'h'}>
          <OutlinedObjects drawingId={drawingId} info={hovered} group="hovered" />
          <OverlayedObjects drawingId={drawingId} info={hovered} type="hovered" />
        </React.Fragment>)}
      {selected?.map(info => (
        <React.Fragment key={info.uniqueIdent + 's'}>
          <OutlinedObjects drawingId={drawingId} info={info} group="selected" />
          <OverlayedObjects drawingId={drawingId} info={info} type="selected" />
        </React.Fragment>
      ))}
    </>
  )
}
