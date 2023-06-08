/* eslint-disable react/display-name */
import React from 'react'

import { DrawingID, InteractionInfo } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'

import { OutlinedObjects } from './OutlinedObjects'
import { convertSelToInteraction } from './utils'
import { OverlayedObjects } from './OverlayedObjects'

const useHovered = (drawingId: DrawingID) => {
  const interactionSel = useDrawing(drawingId, d => d.interaction.selected) as InteractionInfo[]
  const interactionHov = useDrawing(drawingId, d => d.interaction.hovered) as InteractionInfo | null

  // Don't hover an item if it is also selected to avoid rendering 2 semi-transparent overlays at once right after the selection
  return interactionSel.some(info => info.uniqueIdent === interactionHov?.uniqueIdent) ? null : interactionHov
}

const useSelected = (drawingId: DrawingID) => {
  const interactionSel = useDrawing(drawingId, d => d.interaction.selected) as InteractionInfo[]

  const isSelActive = useDrawing(drawingId, d => d.selection.active !== null) || false
  const selectionItems = useDrawing(drawingId, d => d.selection.refs[d.selection.active || '']?.items)
  const selectionInfo = convertSelToInteraction(drawingId, selectionItems || [])

  return isSelActive ? selectionInfo : interactionSel
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
