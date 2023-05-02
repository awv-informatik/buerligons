import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { DrawingID, getDrawing } from '@buerli.io/core'
import {
  BuerliGeometry,
  BuerliPluginsGeometry,
  PluginManager,
  SuspendBuerliGeometry,
  useBuerli,
  useDrawing,
} from '@buerli.io/react'
import { Drawing, HoveredConstraintDisplay } from '@buerli.io/react-cad'
import { GizmoHelper, GizmoViewcube, GizmoViewport } from '@react-three/drei'
import { Canvas, events } from '@react-three/fiber'
import React, { Suspense } from 'react'
import { useIPC } from '../ipc'
import { Composer, Controls, Fit, GeometryInteraction, Lights, raycastFilter, Threshold } from './canvas'
import { ChooseCCApp } from './ChooseCCApp'
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

const RenameGroups: React.FC<{ target: any }> = ({ target }) => {
  // The name of each <group> is set to the corresponding object name in BuerliGeometry.
  // Because buerligons needs the name be set to the id of the object, it has to be renamed here.
  React.useLayoutEffect(() => {
    target.current.traverse((node: any) => {
      // userData.id is set for each relevant <group> in BuerliGeometry
      if (node.userData?.id) {
        node.name = `${node.userData.id}`
      }
    })
  })
  return null
}

export const Buerligons: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.active || '')
  const currentNode = useDrawing(drawingId, d => d.structure.currentNode) || undefined
  const currentProduct = useDrawing(drawingId, d => d.structure.currentProduct)
  const curProdClass = useDrawing(drawingId, d => currentProduct && d.structure.tree[currentProduct]?.class) || ''
  const isPart = ccUtils.base.isA(curProdClass, CCClasses.CCPart)
  const ref = React.useRef<any>()

  const ipc = useIPC()

  React.useEffect(() => void (document.title = 'buerligons'), [])

  // Reset selection when switching nodes
  React.useEffect(() => {
    const setSelected = getDrawing(drawingId)?.api.interaction.setSelected
    setSelected && setSelected([])
  }, [drawingId, currentNode])

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

              <Suspense fallback={null}>
                <Fit drawingId={drawingId}>
                  <Composer
                    drawingId={drawingId}
                    radius={0.1}
                    hoveredColor="green"
                    selectedColor="red"
                    edgeStrength={3}>
                    <GeometryInteraction drawingId={drawingId}>
                      <group ref={ref}>
                        <BuerliGeometry drawingId={drawingId} productId={isPart ? currentProduct : currentNode} />
                      </group>
                    </GeometryInteraction>
                  </Composer>
                  <BuerliPluginsGeometry drawingId={drawingId} />
                </Fit>
                <SuspendBuerliGeometry drawingId={drawingId} />
                <RenameGroups target={ref} />
              </Suspense>

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
