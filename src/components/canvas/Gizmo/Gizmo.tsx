import React from 'react'
import * as THREE from 'three'

import { createApi } from '@buerli.io/classcad'
import { DrawingID, getDrawing, ObjectID } from '@buerli.io/core'
import { GlobalTransform } from '@buerli.io/react'
import { HUD } from '@buerli.io/react-cad'
import { PivotControls } from '@react-three/drei'

import { findInteractableParent } from './utils'

// Artificial delay in 16 ms.
const artifDelay = 16
let promise: Promise<any> | null

export const Gizmo: React.FC<{ drawingId: DrawingID; productId: ObjectID; matrix: THREE.Matrix4 }> = ({
  drawingId,
  productId,
  matrix,
}) => {
  const dragInfo = React.useRef<{ mPInv: THREE.Matrix4; mL0CInv: THREE.Matrix4 } | null>(null)
  const mdL = React.useRef<THREE.Matrix4 | null>(null)
  const isBlocked = React.useRef<boolean>(false)

  const { position, rotation } = React.useMemo(() => {
    return {
      position: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),
      rotation: new THREE.Euler().setFromRotationMatrix(matrix).toArray() as [number, number, number],
    }
  }, [matrix])

  const onDragStart = React.useCallback(
    ({ component }: { component: 'Arrow' | 'Slider' | 'Rotator' }) => {
      if (isBlocked.current) {
        return
      }

      const drawing = getDrawing(drawingId)
      const curProdId = drawing.structure.currentProduct
      const curInstanceId = drawing.structure.currentInstance
      const draggedInstanceId = findInteractableParent(drawingId, productId)
      if (!curProdId || !curInstanceId || !draggedInstanceId || !productId) {
        return
      }

      const mP = drawing.api.structure.calculateGlobalTransformation(curInstanceId)
      const mPInv = mP.clone().invert()
      const mL0C = drawing.api.structure.calculateGlobalTransformation(productId).premultiply(mPInv)
      const mL0CInv = mL0C.invert()

      const pivotPos = new THREE.Vector3(...position).applyMatrix4(mL0C).toArray()
      const mucType = component === 'Arrow' ? 'TRANSLATION_1D' : component === 'Slider' ? 'TRANSLATION_2D' : 'ROTATION'

      const selected = drawing.interaction.selected || []
      const selectedRefs = selected.map(obj =>
        obj.prodRefId ? findInteractableParent(drawingId, obj.prodRefId) : null,
      )
      const selectedRefsUnique = selectedRefs.filter(
        (refId, id) => refId && id === selectedRefs.indexOf(refId),
      ) as ObjectID[]
      const draggedInstances = selectedRefsUnique.map(
        id => (drawing.structure.tree[id].members?.productRef?.value || id) as ObjectID,
      )

      dragInfo.current = { mPInv, mL0CInv }
      createApi(drawingId).v1.assembly.startMovingUnderConstraints({
        id: curProdId,
        instanceIds: draggedInstances,
        pivotInfo: pivotPos,
        mucType,
      })
    },
    [drawingId, productId, position],
  )

  const transformInstances = React.useCallback(
    async (mdL_: THREE.Matrix4) => {
      const curProdId = getDrawing(drawingId).structure.currentProduct || -1

      const rot = {
        xDir: [mdL_.elements[0], mdL_.elements[1], mdL_.elements[2]],
        yDir: [mdL_.elements[4], mdL_.elements[5], mdL_.elements[6]],
        zDir: [mdL_.elements[8], mdL_.elements[9], mdL_.elements[10]],
      }
      const offset = [mdL_.elements[12], mdL_.elements[13], mdL_.elements[14]]

      promise = createApi(drawingId).v1.assembly.moveUnderConstraints({ id: curProdId, rotation: rot, offset }).catch(console.warn)
      await promise

      // Artificial slowdown to lessen network/server burden
      await new Promise(resolve => setTimeout(resolve, artifDelay))
      promise = null

      if (mdL.current) {
        transformInstances(mdL.current.clone())
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
        transformInstances(mdL_)
      }
    },
    [transformInstances],
  )

  const onDragEnd = React.useCallback(() => {
    if (!dragInfo.current) {
      return
    }

    dragInfo.current = null
    mdL.current = null
    const curProdId = getDrawing(drawingId).structure.currentProduct || -1
    createApi(drawingId).v1.assembly.finishMovingUnderConstraints({ id: curProdId })
  }, [drawingId])

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => (isBlocked.current = e.shiftKey)

    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)

    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
    }
  }, [])

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
          annotations={false}
        />
      </GlobalTransform>
    </HUD>
  )
}
