import { CCClasses, ccUtils } from '@buerli.io/classcad'
import { DrawingID, getDrawing, IStructureObject, MathUtils } from '@buerli.io/core'
import { BuerliGeometry, BuerliPluginsGeometry, PluginManager, useBuerli, useDrawing } from '@buerli.io/react'
import { Drawing, HoveredConstraintDisplay } from '@buerli.io/react-cad'
import { GizmoHelper, GizmoViewcube, GizmoViewport } from '@react-three/drei'
import { Canvas, events, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import React from 'react'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { useIPC } from '../ipc'
import { ChooseCCApp } from './ChooseCCApp'
import { Composer, Controls, Fit, Lights, Threshold, raycastFilter, GeometryInteraction } from './canvas'
import { FileMenu } from './FileMenu'
import { UndoRedoKeyHandler } from './KeyHandler'
import { WelcomePage } from './WelcomePage'

const GeometryWrapper: React.FC<{ node: React.ReactNode; object: IStructureObject }> = ({
  node,
  object: { id, coordinateSystem: csys },
}) => {
  const invalidate = useThree(state => state.invalidate)
  const group = React.useRef<THREE.Group>(null!)
  const matrix: THREE.Matrix4 = React.useMemo(
    () => (csys ? MathUtils.convertToMatrix4(csys) : new THREE.Matrix4()),
    [csys],
  )

  useFrame((state, delta) => {
    // Damp towards the coordinate system we got from object.coordinateSystem
    const parent = group.current?.parent
    if (parent) {
      // Invalidate if the value hasn't matched target (matrix) yet
      if (easing.dampM(parent.matrix, matrix, 0.2, delta, Infinity)) invalidate()
    }
  })

  // This runs before the component is rendererd in threejs
  React.useLayoutEffect(() => {
    // Set our parent matrix to identity, that matrix has been set previously by <BurliGeometry>
    // We need to remove it and then damp towards the coordinate system we got from object.coordinateSystem
    const parent = group.current?.parent
    if (parent) parent.matrix.identity()
    invalidate(100)
  })

  // Wrap whatever we get from CC into a group, catch a ref
  return (
    <group name={id.toString()} ref={group}>
      {node}
    </group>
  )
}

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

export const Buerligons: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.active || '')
  const currentNode = useDrawing(drawingId, d => d.structure.currentNode) || undefined
  const currentProduct = useDrawing(drawingId, d => d.structure.currentProduct)
  const curProdClass = useDrawing(drawingId, d => currentProduct && d.structure.tree[currentProduct]?.class) || ''
  const isPart = ccUtils.base.isA(curProdClass, CCClasses.CCPart)

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

              <Fit drawingId={drawingId}>
                <Composer drawingId={drawingId} radius={0.1} hoveredColor="green" selectedColor="red" edgeStrength={3}>
                  <GeometryInteraction drawingId={drawingId}>
                    <BuerliGeometry drawingId={drawingId} productId={isPart ? currentProduct : currentNode}>
                      {props => <GeometryWrapper {...props} />}
                    </BuerliGeometry>
                  </GeometryInteraction>
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
