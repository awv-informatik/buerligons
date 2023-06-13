/* eslint-disable react/display-name */
import React from 'react'

import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { DrawingID } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { useBuerli, useDrawing } from '@buerli.io/react'
import { Outline } from '@buerli.io/react-cad'

import { useOutlinesStore } from './Interaction'
import { AutoClear } from './AutoClear'

const useIsSketchActive = () => {
  return useBuerli(s => {
    const drawing = s.drawing.refs[s.drawing.active!]
    const plugin = drawing ? drawing.plugin.refs[drawing.plugin.active.feature!] : null
    const objClass = drawing.structure.tree[plugin?.id || -1]?.class || ''
    return ccUtils.base.isA(objClass, CCClasses.CCSketch)
  })
}

const useOutlinesColor = (drawingId: DrawingID) => {
  const isSelActive = useDrawing(drawingId, d => d.selection.active !== null) || false
  return React.useMemo(() => {
    return isSelActive ? { hColor: ['#3280ff', '#194080'], sColor: ['#8040c0', '#402060'] } : { hColor: ['#008000', '#00ff00'], sColor: ['#ff0000', '#ffa000'] }
  }, [isSelActive])
}

export function Composer({
  children,
  drawingId,
  width = 5,
  radius = 0.1,
  ao = true,
  ...props
}: any) {
  return (
    <>
      <Chain
        drawingId={drawingId}
        width={width}
        radius={radius}
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
  ({  radius, drawingId, width, ao = true, ...props }: any) => {
    const isSketchActive = useIsSketchActive() // Skip AO when sketch is active

    return (
      <EffectComposer enabled renderPriority={2} multisampling={8} autoClear={false} {...props}>
        {ao && !isSketchActive && <N8AO aoRadius={50} intensity={7} distanceFalloff={0.2} aoSamples={20} denoiseSamples={20} denoiseRadius={20} screenSpaceRadius quality="medium" color="black" />}
        <MultiOutline drawingId={drawingId} width={width} />
      </EffectComposer>
    )
  },
)

// The outline component will update itself without disturbing the parental effect composer
const MultiOutline = React.memo(
  ({ drawingId, width = 5 }: any) => {
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
        edgeColor1={hColor as any}
        edgeColor2={sColor as any}
      />
    )
  },
)
