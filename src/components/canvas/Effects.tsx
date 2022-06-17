import React from 'react'

import { EffectComposer, SSAO } from '@react-three/postprocessing'
import { CCClasses } from '@buerli.io/classcad'
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
  ...props
}: any) {
  const hovered = useDrawing(drawingId, d => d.interaction.hovered)
  const selected = useDrawing(drawingId, d => d.interaction.selected)

  const hoveredMeshes = useOutlinesStore(s => s.outlinedMeshes['hovered'])
  const selectedMeshes = useOutlinesStore(s => s.outlinedMeshes['selected'])

  const selections1 = React.useMemo(() => selectedMeshes? Object.values(selectedMeshes) : [], [selectedMeshes])
  const selections2 = React.useMemo(() => hoveredMeshes? Object.values(hoveredMeshes) : [], [hoveredMeshes])

  /* const merged = React.useMemo(() => {
    const selectedArr = Object.values(selectedMeshes || {})

    if (selectedArr.length > 3) {
      const merged_: THREE.Object3D[] = []
      selectedArr.forEach(selected => merged_.push(...selected))

      return merged_
    }

    return []
  }, [selectedMeshes]) */

  // Skip outlines when selection is active
  // const selectionActive = useBuerli(s => !!s.drawing.refs[s.drawing.active!]?.selection.active)
  // Skip AO when sketch is active
  const sketchActive = useBuerli(s => {
    const drawing = s.drawing.refs[s.drawing.active!]
    const plugin = drawing ? drawing.plugin.refs[drawing.plugin.active.feature!] : null
    return plugin ? drawing.structure.tree[plugin.id]?.class === CCClasses.CCSketch : false
  })

  // Decide if effects-chain is active or not
  const enabled = !sketchActive

  return (
    <>
      <EffectComposer enabled={enabled} multisampling={8} autoClear={false} {...props}>
        <SSAO radius={radius} intensity={85} luminanceInfluence={0.2} color="black" />
        <Outline
          selections1={selections1}
          selections2={selections2}
          selectionLayer={10}
          edgeColor1={selectedColor as any}
          edgeColor2={hoveredColor as any}
          edgeStrength={edgeStrength}
        />
      </EffectComposer>
      {hovered && <OutlinedObjects drawingId={drawingId} info={hovered} group="hovered" />}
      {selected?.map(info => (
        <OutlinedObjects key={info.objectId} drawingId={drawingId} info={info} group="selected" />
      ))}
      {!enabled && <AutoClear />}
      {children}
    </>
  )
}
