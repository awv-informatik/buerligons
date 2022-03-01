import { CCClasses } from '@buerli.io/classcad'
import { DrawingID, getDrawing } from '@buerli.io/core'
import {
  BuerliGeometry,
  BuerliPluginsGeometry,
  PluginManager,
  raycastFilter,
  useBuerli,
  useDrawing,
} from '@buerli.io/react'
import { Drawing, HoveredConstraintDisplay } from '@buerli.io/react-cad'
import { GizmoHelper, GizmoViewcube, GizmoViewport } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import 'antd/dist/antd.css'
import React from 'react'
import { AutoClear, Controls, Fit, Lights } from './components/canvas'
import { FileMenu } from './components/FileMenu'
import { WelcomePage } from './components/WelcomePage'

const CanvasImpl: React.FC<{ drawingId: DrawingID }> = ({ children, drawingId }) => {
  const handleMiss = React.useCallback(() => {
    const selApi = getDrawing(drawingId)?.api.selection
    selApi?.unselectAll()
  }, [drawingId])

  return (
    <Canvas
      dpr={[1, 2]}
      raycaster={{ filter: raycastFilter }}
      linear
      orthographic
      camera={{ position: [0, 0, 10], zoom: 50 }}
      onPointerMissed={handleMiss}>
      <HoveredConstraintDisplay drawingId={drawingId} />
      {children}
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

  React.useEffect(() => void (document.title = 'Buerligons'), [])

  return (
    <div style={{ backgroundColor: '#fff', height: '100%', width: '100%' }}>
      {count === 0 || !drawingId ? (
        <WelcomePage />
      ) : (
        <>
          <PluginManager />
          <Drawing drawingId={drawingId} Menu={<FileMenu drawingId={drawingId} />}>
            <CanvasImpl drawingId={drawingId}>
              <Controls makeDefault staticMoving rotateSpeed={2} />
              <Lights drawingId={drawingId} />
              <AutoClear />

              <Fit drawingId={drawingId}>
                <BuerliGeometry drawingId={drawingId} productId={isPart ? currentProduct : currentNode} />
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
          </Drawing>
        </>
      )}
    </div>
  )
}

export default Buerligons
