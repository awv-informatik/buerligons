import React from 'react'
import * as THREE from 'three'

import { ccAPI } from '@buerli.io/classcad'
import { DrawingID, getDrawing, ObjectID } from '@buerli.io/core'
import { GlobalTransform } from '@buerli.io/react'
import { HUD } from '@buerli.io/react-cad'
import { PivotControls } from '@react-three/drei'

import { findInteractableParent } from './utils'

// Artificial delay in 16 ms.
const artifDelay = 16
let promise: Promise<void> | null

export const Gizmo: React.FC<{ drawingId: DrawingID; productId: ObjectID; matrix: THREE.Matrix4 }> = ({
  drawingId,
  productId,
  matrix,
}) => {
  const dragInfo = React.useRef<{ mPInv: THREE.Matrix4; mL0CInv: THREE.Matrix4 } | null>(null)
  const mdL = React.useRef<THREE.Matrix4 | null>(null)

  const { position, rotation } = React.useMemo(() => {
    return {
      position: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),
      rotation: new THREE.Euler().setFromRotationMatrix(matrix).toArray() as [number, number, number],
    }
  }, [matrix])

  const onDragStart = React.useCallback(
    ({ component }: { component: 'Arrow' | 'Slider' | 'Rotator' }) => {
      const drawing = getDrawing(drawingId)
      const curProdId = drawing.structure.currentProduct
      const curNodeId = drawing.structure.currentNode
      const draggedNodeId = findInteractableParent(drawingId, productId)
      if (!curProdId || !curNodeId || !draggedNodeId || !productId) {
        return
      }

      const mP = drawing.api.structure.calculateGlobalTransformation(curNodeId)
      const mPInv = mP.clone().invert()
      const mL0C = drawing.api.structure.calculateGlobalTransformation(productId).premultiply(mPInv)
      const mL0CInv = mL0C.invert()

      const pivotPos = new THREE.Vector3(...position).applyMatrix4(mL0C).toArray()
      const mucType = component === 'Arrow' ? 0 : component === 'Slider' ? 1 : 2

      const selected = drawing.interaction.selected || []
      const selectedRefs = selected.map(obj =>
        obj.prodRefId ? findInteractableParent(drawingId, obj.prodRefId) : null,
      )
      const selectedRefsUnique = selectedRefs.filter(
        (refId, id) => refId && id === selectedRefs.indexOf(refId),
      ) as ObjectID[]
      const draggedNodes = selectedRefsUnique.map(
        id => (drawing.structure.tree[id].members?.productRef?.value || id) as ObjectID,
      )

      dragInfo.current = { mPInv, mL0CInv }
      ccAPI.assemblyBuilder.startMovingUnderConstraints(drawingId, curProdId, draggedNodes, pivotPos, mucType)
    },
    [drawingId, productId, position],
  )

  const transformNodes = React.useCallback(
    async (mdL_: THREE.Matrix4) => {
      const curProdId = getDrawing(drawingId).structure.currentProduct || -1

      const rot: number[] = []
      const offset: number[] = []
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          rot.push(mdL_.elements[j * 4 + i])
        }
        offset.push(mdL_.elements[i + 12])
      }
      promise = ccAPI.assemblyBuilder.moveUnderConstraints(drawingId, curProdId, rot, offset).catch(console.warn)
      await promise

      // Artificial slowdown to lessen network/server burden
      await new Promise(resolve => setTimeout(resolve, artifDelay))
      promise = null

      if (mdL.current) {
        transformNodes(mdL.current.clone())
        mdL.current = null
      }
    },
    [drawingId],
  )

  const onDrag = React.useCallback(
    (l: THREE.Matrix4, deltaL: THREE.Matrix4, w: THREE.Matrix4, deltaW: THREE.Matrix4) => {
      if (!dragInfo.current) {
        return
      }

      const mdL_ = dragInfo.current.mPInv.clone().multiply(w).multiply(dragInfo.current.mL0CInv)

      if (promise) {
        mdL.current = mdL_
      } else {
        transformNodes(mdL_)
      }
    },
    [transformNodes],
  )

  const onDragEnd = React.useCallback(() => {
    dragInfo.current = null
    mdL.current = null
    const curProdId = getDrawing(drawingId).structure.currentProduct || -1
    ccAPI.assemblyBuilder.finishMovingUnderConstraints(drawingId, curProdId)
  }, [drawingId])

  return (
    <HUD>
      <GlobalTransform drawingId={drawingId} objectId={productId}>
        <PivotControls
          scale={96}
          lineWidth={5}
          fixed
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          offset={position}
          rotation={rotation}
          autoTransform={false}
          userData={{ onHUD: true }}
          displayValues={false}
        />
      </GlobalTransform>
    </HUD>
  )
}
