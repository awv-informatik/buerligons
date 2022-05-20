import React from 'react'

import { EffectComposer, Outline, SSAO } from '@react-three/postprocessing'
import { CCClasses } from '@buerli.io/classcad'
import { useBuerli } from '@buerli.io/react'

import { useOutlinesStore } from './OutlinesStore'
import { OutlinedObjects } from './OutlinedObjects'
import { AutoClear } from '../../components'

export function Composer({
  children,
  drawingId,
  hovered,
  xRay = true,
  blur = true,
  color = 'white',
  hiddenColor = undefined,
  edgeStrength = 100,
  width = 1000,
  radius = 0.1,
  blendFunction = 2,
  ...props
}: any) {
  const outlinedMeshes = useOutlinesStore(s => s.outlinedMeshes)

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
        {Object.values(outlinedMeshes).map((meshes, i) => (
          <Outline
            key={i}
            selection={meshes}
            selectionLayer={10 + i}
            blendFunction={blendFunction}
            xRay={xRay}
            blur={blur}
            hiddenEdgeColor={color as any}
            visibleEdgeColor={color as any}
            edgeStrength={edgeStrength}
            width={width}
          />
        ))}
      </EffectComposer>
      <OutlinedObjects drawingId={drawingId} hovered={hovered} />
      {!enabled && <AutoClear />}
      {children}
    </>
  )
}
