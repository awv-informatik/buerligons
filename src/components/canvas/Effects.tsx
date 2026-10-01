/* eslint-disable react/display-name */
import React from 'react'

import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { Outline, useRCadThemeMode, useStage } from '@buerli.io/react-cad'

import { useOutlinesStore } from './Interaction'
import { AutoClear } from './AutoClear'

type OutlineColorRepresentation = [THREE.ColorRepresentation, THREE.ColorRepresentation]

// What is under the pointer is outlined in the highlight, held back; what is in hand, in the
// highlight; what a feature's field has taken, in red. (The second of each pair stands in on a
// body of nearly that colour.)
const useOutlinesColor = (drawingId: DrawingID): { hColor: OutlineColorRepresentation, sColor: OutlineColorRepresentation } => {
  const isSelActive = useDrawing(drawingId, d => d.selection.active !== null) || false
  const stage = useStage()
  return React.useMemo(() => {
    return { hColor: [stage.hover, stage.alt], sColor: [isSelActive ? stage.pick : stage.select, stage.alt] }
  }, [isSelActive, stage])
}

export function Composer({
  children,
  drawingId,
  width = 4,
  ao = true,
  ...props
}: any) {
  return (
    <>
      <Chain
        drawingId={drawingId}
        width={width}
        ao={ao}
        {...props}
      />
      <AutoClear />
      {children}
    </>
  )
}

// Make the effects chain a stable, memoized component
const Chain = React.memo(
  ({ drawingId, width, ao = true, ...props }: any) => {
    // (what faces shade each other with is ink; in the dark, the dark itself)
    const shade = useRCadThemeMode() === 'dark' ? '#08090b' : '#0f1320'
    return (
      <EffectComposer enabled renderPriority={2} multisampling={8} autoClear={false} {...props}>
        {/* a little depth where faces meet: enough to read a corner, not enough to grey the paper */}
        {ao && <N8AO aoRadius={36} halfRes intensity={1.1} distanceFalloff={1} screenSpaceRadius color={shade} />}
        <MultiOutline drawingId={drawingId} width={width} />
      </EffectComposer>
    )
  },
)

// The outline component will update itself without disturbing the parental effect composer
const MultiOutline = React.memo(
  ({ drawingId, width = 4 }: any) => {
    const hoveredMeshes = useOutlinesStore(s => s.outlinedMeshes['hovered'])
    const selectedMeshes = useOutlinesStore(s => s.outlinedMeshes['selected'])
    const selections1 = React.useMemo(() => (hoveredMeshes ? Object.values(hoveredMeshes) : []), [hoveredMeshes])
    const selections2 = React.useMemo(() => (selectedMeshes ? Object.values(selectedMeshes) : []), [selectedMeshes])
    const { hColor, sColor } = useOutlinesColor(drawingId)
    return (
      <Outline
        selections1={selections1}
        selections2={selections2}
        selectionLayer={10}
        width={width}
        edgeColor1={hColor}
        edgeColor2={sColor}
      />
    )
  },
)
