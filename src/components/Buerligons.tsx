import { CCClasses } from '@buerli.io/classcad'
import { DrawingID, getDrawing } from '@buerli.io/core'
import {
  BuerliGeometry,
  BuerliPluginsGeometry,
  PluginManager,
  useBuerli,
  useDrawing,
} from '@buerli.io/react'
import { Drawing, HoveredConstraintDisplay, InteractionInfo } from '@buerli.io/react-cad'
import { GizmoHelper, GizmoViewcube, GizmoViewport } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import React from 'react'
import create from 'zustand'
import { Composer, Controls, Fit, Lights, Threshold, raycastFilter } from './canvas'
import { FileMenu } from './FileMenu'
import { UndoRedoKeyHandler } from './KeyHandler'
import { WelcomePage } from './WelcomePage'

const useStore = create<{
  hovered: InteractionInfo
  selected: InteractionInfo[]
  setHovered: (hovered: InteractionInfo) => void
  setSelected: (selected: InteractionInfo) => void
}>((set, get) => ({
  hovered: null,
  selected: [],
  setHovered: (hovered: InteractionInfo) => set({ hovered }),
  setSelected: (selected: InteractionInfo) => 
    set(state => {
      if (selected === null) {
        return { selected: [] }
      }
      if (state.selected.findIndex(info => info?.objectId === selected?.objectId) !== -1) {
        return { selected: state.selected.filter(info => info?.objectId !== selected?.objectId) }
      }
      
      return { selected: [...state.selected, selected] }
    }),
}))

const CanvasImpl: React.FC<{ drawingId: DrawingID }> = ({ children, drawingId }) => {
  const hovered = useStore(state => state.hovered) as any
  const hoveredConstrId = hovered?.type === 'Constraint' ? hovered.objectId : null
  const setSelected = useStore(state => state.setSelected)

  const handleMiss = React.useCallback(() => {
    setSelected(null)
    getDrawing(drawingId)?.api.selection?.unselectAll()
  }, [drawingId, setSelected])

  // Remove selection on ESC
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && handleMiss()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleMiss])

  return (
    <Canvas
      orthographic
      frameloop="demand"
      dpr={[1, 2]}
      raycaster={{ filter: raycastFilter }}
      camera={{ position: [0, 0, 10], zoom: 50 }}
      onPointerMissed={handleMiss}>
      <HoveredConstraintDisplay drawingId={drawingId} hoveredId={hoveredConstrId} />
      <React.Suspense fallback={null}>{children}</React.Suspense>
    </Canvas>
  )
}

export const Buerligons: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.active || '')
  const currentNode = useDrawing(drawingId, d => d.structure.currentNode) || undefined
  const currentProduct = useDrawing(drawingId, d => d.structure.currentProduct)
  const curProdClass = useDrawing(drawingId, d => (currentProduct && d.structure.tree[currentProduct]?.class) || '')
  const isPart = curProdClass === CCClasses.CCPart

  const hovered = useStore(state => state.hovered) as any
  const selected = useStore(state => state.selected) as any
  const setHovered = useStore(state => state.setHovered) as any
  const setSelected = useStore(state => state.setSelected) as any

  React.useEffect(() => void (document.title = 'Buerligons'), [])

  // Reset selection when switching nodes
  React.useEffect(() => setSelected(null), [currentNode, setSelected])

  return (
    <div style={{ backgroundColor: '#fff', height: '100%', width: '100%' }}>
      {count === 0 || !drawingId ? (
        <WelcomePage />
      ) : (
        <>
          <PluginManager />
          <Drawing
            hoveredId={hovered?.objectId}
            selectedIds={selected?.map(info => info.objectId)}
            drawingId={drawingId}
            Menu={<FileMenu drawingId={drawingId} />}
            onHover={setHovered}
            onClick={setSelected}>
            <CanvasImpl drawingId={drawingId}>
              <Controls makeDefault staticMoving rotateSpeed={2} />
              <Lights drawingId={drawingId} />
              <Threshold />

              <Fit drawingId={drawingId}>
                <Composer
                  drawingId={drawingId}
                  hovered={hovered}
                  selected={selected}
                  radius={0.1}
                  hoveredColor="green"
                  selectedColor="red"
                  edgeStrength={3}>
                  <>
                    <BuerliGeometry drawingId={drawingId} productId={isPart ? currentProduct : currentNode} />
                  </>
                </Composer>
                <BuerliPluginsGeometry drawingId={drawingId} />
              </Fit>

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
