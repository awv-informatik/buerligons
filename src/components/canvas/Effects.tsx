import React from 'react'
import * as THREE from 'three'
import create from 'zustand'

import { EffectComposer, Outline, SSAO } from '@react-three/postprocessing'
import { ObjectID } from '@buerli.io/core'
import { useBuerli } from '@buerli.io/react'
import { CCClasses } from '@buerli.io/classcad'

import { AutoClear } from './AutoClear'

const useOutlinesStore = create<{
  hoveredMeshes: { [key: number]: THREE.Object3D[] }
  selectedMeshes: { [key: number]: THREE.Object3D[] }
  setHoveredMeshes: (id: ObjectID, hoveredMeshes: THREE.Object3D[]) => void
  setSelectedMeshes: (id: ObjectID, selectedMeshes: THREE.Object3D[]) => void
  unhoverMesh: (id: ObjectID) => void
  unselectMesh: (id: ObjectID) => void
}>((set, get) => ({
  hoveredMeshes: {},
  selectedMeshes: {},
  setHoveredMeshes: (id: ObjectID, hoveredMeshes_: THREE.Object3D[]) =>
    set(state => ({ hoveredMeshes: { ...state.hoveredMeshes, [id]: hoveredMeshes_ } })),
  setSelectedMeshes: (id: ObjectID, selectedMeshes_: THREE.Object3D[]) =>
    set(state => ({ selectedMeshes: { ...state.selectedMeshes, [id]: selectedMeshes_ } })),
  unhoverMesh: (id: ObjectID) =>
    set(state => {
      const hoveredMeshes_ = { ...state.hoveredMeshes }
      delete hoveredMeshes_[id]
      return { hoveredMeshes: hoveredMeshes_ }
    }),
  unselectMesh: (id: ObjectID) =>
    set(state => {
      const selectedMeshes_ = { ...state.selectedMeshes }
      delete selectedMeshes_[id]
      return { selectedMeshes: selectedMeshes_ }
    }),
}))

export function OutlinesSelector({
  objectId,
  isHovered,
  isSelected,
  children,
  ...props
}: JSX.IntrinsicElements['group'] & { objectId: ObjectID; isHovered: boolean; isSelected: boolean }) {
  const hoveredMeshes = useOutlinesStore(s => s.hoveredMeshes)
  const selectedMeshes = useOutlinesStore(s => s.selectedMeshes)
  const setHoveredMeshes = useOutlinesStore(s => s.setHoveredMeshes)
  const setSelectedMeshes = useOutlinesStore(s => s.setSelectedMeshes)
  const unhoverMesh = useOutlinesStore(s => s.unhoverMesh)
  const unselectMesh = useOutlinesStore(s => s.unselectMesh)

  const group = React.useRef<THREE.Group>(null!)

  React.useEffect(() => {
    if (isHovered) {
      let changed = false
      if (!hoveredMeshes[objectId]) changed = true

      const current: THREE.Object3D[] = []
      group.current.traverse(o => {
        o.type === 'Mesh' && current.push(o)
        if (hoveredMeshes[objectId]?.indexOf(o) === -1) changed = true
      })

      if (changed) {
        setHoveredMeshes(objectId, current)
        return () => {
          unhoverMesh(objectId)
        }
      }
    }
  }, [hoveredMeshes, isHovered, objectId, setHoveredMeshes, unhoverMesh])

  React.useEffect(() => {
    if (isSelected) {
      let changed = false
      if (!selectedMeshes[objectId]) changed = true

      const current: THREE.Object3D[] = []
      group.current.traverse(o => {
        o.type === 'Mesh' && current.push(o)
        if (selectedMeshes[objectId]?.indexOf(o) === -1) changed = true
      })

      if (changed) {
        setSelectedMeshes(objectId, current)
        return () => {
          unselectMesh(objectId)
        }
      }
    }
  }, [isSelected, objectId, selectedMeshes, setSelectedMeshes, unselectMesh])

  return (
    <group ref={group} {...props}>
      {children}
    </group>
  )
}

export function Composer({
  children,
  xRay = true,
  blur = true,
  hoveredColor = 'white',
  selectedColor = 'white',
  hiddenColor = undefined,
  edgeStrength = 100,
  width = 1000,
  radius = 0.1,
  blendFunction = 2,
  ...props
}: any) {
  // Skip AO when sketch is active
  const sketchActive = useBuerli(s => {
    const drawing = s.drawing.refs[s.drawing.active!]
    const plugin = drawing ? drawing.plugin.refs[drawing.plugin.active.feature!] : null
    return plugin ? drawing.structure.tree[plugin.id]?.class === CCClasses.CCSketch : false
  })

  // Decide if effects-chain is active or not
  const enabled = !sketchActive

  const hoveredMeshes = useOutlinesStore(s => s.hoveredMeshes)
  const selectedMeshes = useOutlinesStore(s => s.selectedMeshes)

  return (
    <>
      <EffectComposer enabled={enabled} multisampling={8} autoClear={false} {...props}>
        <SSAO radius={radius} intensity={85} luminanceInfluence={0.2} color="black" />
        {Object.values(hoveredMeshes).map((hovArray, i) => (
          <Outline
            key={10 + i}
            selection={hovArray}
            selectionLayer={10 + i}
            blendFunction={blendFunction}
            //blendFunction={selectionActive ? 0 : blendFunction}
            xRay={xRay}
            blur={blur}
            hiddenEdgeColor={hiddenColor || hoveredColor}
            visibleEdgeColor={hoveredColor}
            edgeStrength={edgeStrength}
            width={width}
          />
        ))}
        {Object.values(selectedMeshes).map((selArray, i) => (
          <Outline
            key={100 + i}
            selection={selArray}
            selectionLayer={100 + i}
            blendFunction={blendFunction}
            //blendFunction={selectionActive ? 0 : blendFunction}
            xRay={xRay}
            blur={blur}
            hiddenEdgeColor={hiddenColor || selectedColor}
            visibleEdgeColor={selectedColor}
            edgeStrength={edgeStrength}
            width={width}
          />
        ))}
      </EffectComposer>
      {!enabled && <AutoClear />}
      {children}
    </>
  )
}
