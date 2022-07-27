/* eslint-disable react/display-name */
import React from 'react'

import { EffectComposer, SSAO } from '@react-three/postprocessing'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { useBuerli, useDrawing } from '@buerli.io/react'
import { Outline } from '@buerli.io/react-cad'

import { useOutlinesStore } from './OutlinesStore'
import { OutlinedObjects } from './OutlinedObjects'
import { AutoClear } from './AutoClear'

export function Composer({
  children,
  drawingId,
  hoveredColor = 'white',
  selectedColor = 'white',
  edgeStrength = 100,
  radius = 0.1,
  ssao = true,
  ...props
}: any) {
  const hovered = useDrawing(drawingId, d => d.interaction.hovered)
  const selected = useDrawing(drawingId, d => d.interaction.selected)
  // Skip outlines when selection is active
  // const selectionActive = useBuerli(s => !!s.drawing.refs[s.drawing.active!]?.selection.active)
  // Skip AO when sketch is active
  const sketchActive = useBuerli(s => {
    const drawing = s.drawing.refs[s.drawing.active!]
    const plugin = drawing ? drawing.plugin.refs[drawing.plugin.active.feature!] : null
    const objClass = drawing.structure.tree[plugin?.id || -1]?.class || ''
    return ccUtils.base.isA(objClass, CCClasses.CCSketch)
  })
  // Decide if effects-chain is active or not
  const enabled = !sketchActive
  return (
    <>
      <Chain
        enabled={enabled}
        hoveredColor={hoveredColor}
        selectedColor={selectedColor}
        edgeStrength={edgeStrength}
        radius={radius}
        ssao={ssao}
        {...props}
      />
      {hovered && <OutlinedObjects drawingId={drawingId} info={hovered} group="hovered" />}
      {selected?.map(info => (
        <OutlinedObjects key={info.objectId} drawingId={drawingId} info={info} group="selected" />
      ))}
      {!enabled && <AutoClear />}
      {children}
    </>
  )
}

// Make the effects chain a stable, memoized component
const Chain = React.memo(
  ({ enabled, radius, hoveredColor, selectedColor, edgeStrength, ssao = true, ...props }: any) => {
    return (
      <EffectComposer enabled={enabled} multisampling={8} autoClear={false} {...props}>
        {ssao && <SSAO radius={radius} intensity={85} luminanceInfluence={0.2} color="black" />}
        <MultiOutline
          hoveredColor={hoveredColor}
          selectedColor={selectedColor}
          edgeStrength={edgeStrength}
          radius={radius}
        />
      </EffectComposer>
    )
  },
)

// The outline component will update itself without disturbing the parental effect composer
const MultiOutline = React.memo(
  ({ hoveredColor = 'white', selectedColor = 'white', edgeStrength = 100, radius = 0.1 }: any) => {
    const hoveredMeshes = useOutlinesStore(s => s.outlinedMeshes['hovered'])
    const selectedMeshes = useOutlinesStore(s => s.outlinedMeshes['selected'])
    const selections1 = React.useMemo(() => (selectedMeshes ? Object.values(selectedMeshes) : []), [selectedMeshes])
    const selections2 = React.useMemo(() => (hoveredMeshes ? Object.values(hoveredMeshes) : []), [hoveredMeshes])
    return (
      <Outline
        selections1={selections1}
        selections2={selections2}
        selectionLayer={10}
        edgeColor1={selectedColor as any}
        edgeColor2={hoveredColor as any}
        edgeStrength={edgeStrength}
      />
    )
  },
)
