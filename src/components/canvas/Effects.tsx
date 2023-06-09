/* eslint-disable react/display-name */
import React from 'react'

import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { DrawingID } from '@buerli.io/core'
import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { useBuerli, useDrawing } from '@buerli.io/react'
import { Outline } from '@buerli.io/react-cad'

import { useOutlinesStore } from './Interaction'
import { AutoClear } from './AutoClear'
import { useFrame } from '@react-three/fiber'

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
    return isSelActive ? { hColor: '#3280ff', sColor: '#8040c0' } : { hColor: 'green', sColor: 'red' }
  }, [isSelActive])
}

export function Composer({
  children,
  drawingId,
  edgeStrength = 100,
  radius = 0.1,
  ssao = true,
  ...props
}: any) {
  return (
    <>
      <Chain
        drawingId={drawingId}
        edgeStrength={edgeStrength}
        radius={radius}
        ssao={ssao}
        {...props}
      />
      <AutoClear />
      {children}
    </>
  )
}

// Make the effects chain a stable, memoized component
const Chain = React.memo(
  ({ radius, drawingId, edgeStrength, ssao = true, ...props }: any) => {
    const ssaoRef = React.useRef<any>(null!)
    const cameraPrev = React.useRef<{ near: number, far: number, zoom: number }>({ near: 0.01, far: 10000, zoom: 1 })
    
    useFrame(state => {
      if (!ssaoRef.current) {
        return
      }

      const camera = state.camera
      if (camera.near !== cameraPrev.current.near || camera.far !== cameraPrev.current.far || camera.zoom !== cameraPrev.current.zoom) {
        cameraPrev.current = { near: camera.near, far: camera.far, zoom: camera.zoom }
        ssaoRef.current?.ssaoMaterial?.copyCameraSettings(camera)
      }
    })

    const isSketchActive = useIsSketchActive() // Skip AO when sketch is active

    return (
      <EffectComposer enabled renderPriority={2} multisampling={8} autoClear={false} {...props}>
        {ssao && !isSketchActive && <N8AO ref={ssaoRef} aoRadius={5} intensity={5} aoSamples={30} denoiseSamples={30} denoiseRadius={5} quality="ultra" color="black" />}
        <MultiOutline
          drawingId={drawingId}
          edgeStrength={edgeStrength}
          radius={radius}
        />
      </EffectComposer>
    )
  },
)

// The outline component will update itself without disturbing the parental effect composer
const MultiOutline = React.memo(
  ({ drawingId, edgeStrength = 100, radius = 0.1 }: any) => {
    const hoveredMeshes = useOutlinesStore(s => s.outlinedMeshes['hovered'])
    const selectedMeshes = useOutlinesStore(s => s.outlinedMeshes['selected'])
    const selections1 = React.useMemo(() => (selectedMeshes ? Object.values(selectedMeshes) : []), [selectedMeshes])
    const selections2 = React.useMemo(() => (hoveredMeshes ? Object.values(hoveredMeshes) : []), [hoveredMeshes])
    const { hColor, sColor } = useOutlinesColor(drawingId)
    return (
      <Outline
        selections1={selections1}
        selections2={selections2}
        selectionLayer={10}
        edgeColor1={sColor as any}
        edgeColor2={hColor as any}
        edgeStrength={edgeStrength}
      />
    )
  },
)
