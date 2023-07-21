import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { DrawingID, getDrawing } from '@buerli.io/core'
import { BuerliGeometry, BuerliPluginsGeometry, PluginManager, useBuerli, useDrawing } from '@buerli.io/react'
import { Drawing, HoveredConstraintDisplay, PluginGeometryBounds, GeometryOverridesManager } from '@buerli.io/react-cad'
import { GizmoHelper, GizmoViewcube, GizmoViewport } from '@react-three/drei'
import { Canvas, events } from '@react-three/fiber'
import React from 'react'
import { useIPC } from '../ipc'
import { ChooseCCApp } from './ChooseCCApp'
import { Composer, Controls, Fit, Lights, Threshold, raycastFilter, GeometryInteraction, HighlightedObjects } from './canvas'
import { FileMenu } from './FileMenu'
import { UndoRedoKeyHandler } from './KeyHandler'
import { WelcomePage } from './WelcomePage'

const CanvasImpl: React.FC<{ drawingId: DrawingID; children?: React.ReactNode }> = ({ children, drawingId }) => {
  const handleMiss = React.useCallback(() => {
    const setSelected = getDrawing(drawingId).api.interaction.setSelected
    setSelected([])
    getDrawing(drawingId)?.api.selection?.unselectAll()
  }, [drawingId])

  // Remove selection on ESC
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && handleMiss()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleMiss])

  return (
    <Canvas
      orthographic
      flat
      frameloop="demand"      
      dpr={[1, 2]}
      events={s => ({ ...events(s), filter: raycastFilter })}
      camera={{ position: [0, 0, 10], zoom: 50 }}
      onPointerMissed={handleMiss}>
      <HoveredConstraintDisplay drawingId={drawingId} />
      <React.Suspense fallback={null}>{children}</React.Suspense>
    </Canvas>
  )
}

const useInteractionReset = (drawingId: DrawingID) => {
  const currentInstance = useDrawing(drawingId, d => d.structure.currentInstance)
  const isSelActive = useDrawing(drawingId, d => d.selection.active !== null) || false
  const activeId = useDrawing(drawingId, d => d.plugin.refs[d.plugin.active.feature || -1]?.objectId)
  const objClass = useDrawing(drawingId, d => d.structure.tree[activeId || -1]?.class) || ''
  const isSketchActive = ccUtils.base.isA(objClass, CCClasses.CCSketch)

  const resetInteraction = React.useCallback(() => {
    const interaction = getDrawing(drawingId)?.api.interaction
    interaction?.setHovered(null)
    interaction?.setSelected([])
  }, [drawingId])

  // Reset hover and selection on sketch or selector activation
  React.useEffect(() => {
    if (isSelActive || isSketchActive) {
      resetInteraction()
    }
  }, [resetInteraction, isSelActive, isSketchActive])
  
  // Reset hover and selection when switching nodes
  React.useEffect(() => {
    resetInteraction()
  }, [resetInteraction, currentInstance])
}

export const Buerligons: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.active || '')
  const currentInstance = useDrawing(drawingId, d => d.structure.currentInstance) || undefined
  const currentProduct = useDrawing(drawingId, d => d.structure.currentProduct)
  const curProdClass = useDrawing(drawingId, d => currentProduct && d.structure.tree[currentProduct]?.class) || ''
  const isPart = ccUtils.base.isA(curProdClass, CCClasses.CCPart)

  const ipc = useIPC()

  React.useEffect(() => void (document.title = 'buerligons'), [])

  useInteractionReset(drawingId)

  return (
    <div style={{ backgroundColor: '#fff', height: '100%', width: '100%' }}>
      {ipc.isEmbeddedApp && !ipc.hasClassFile ? (
        <ChooseCCApp />
      ) : count === 0 || !drawingId ? (
        <WelcomePage />
      ) : (
        <>
          <PluginManager />
          <Drawing drawingId={drawingId} Menu={<FileMenu drawingId={drawingId} />}>
            <CanvasImpl drawingId={drawingId}>
              <Controls makeDefault staticMoving rotateSpeed={2} />
              <Lights drawingId={drawingId} />
              <Threshold />
              <GeometryOverridesManager drawingId={drawingId} />

              <Fit drawingId={drawingId}>
                <Composer drawingId={drawingId} width={5}>
                  <GeometryInteraction drawingId={drawingId}>
                    <BuerliGeometry suspend={['.Load']} drawingId={drawingId} nodeId={isPart ? currentProduct : currentInstance} selection={false} />
                  </GeometryInteraction>
                </Composer>
                <PluginGeometryBounds drawingId={drawingId} />
              </Fit>

              <BuerliPluginsGeometry drawingId={drawingId} />
              <HighlightedObjects drawingId={drawingId} />

              <GizmoHelper renderPriority={2} alignment="top-right" margin={[80, 80]}>
                <group scale={0.8}>
                  <group scale={2.25} position={[-30, -30, -30]} rotation={[0, 0, 0]}>
                    <GizmoViewport
                      disabled
                      axisScale={[0.8, 0.02, 0.02]}
                      axisHeadScale={0.45}
                      hideNegativeAxes
                      labelColor="black"
                    />
                  </group>
                  <GizmoViewcube
                    font="24px Inter var, Arial, sans-serif"
                    faces={['Right', 'Left', 'Back', 'Front', 'Top', 'Bottom']}
                  />
                </group>
              </GizmoHelper>
            </CanvasImpl>
            <UndoRedoKeyHandler />
          </Drawing>
        </>
      )}
    </div>
  )
}
