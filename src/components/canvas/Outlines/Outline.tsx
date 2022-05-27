import React from 'react'
import { Object3D } from 'three'
import { Selection } from 'postprocessing'

import { useThree } from '@react-three/fiber'

import { OutlineEffect } from './OutlineEffect'

export type OutlineProps = ConstructorParameters<typeof OutlineEffect>[2] &
  Partial<{
    selections1: Object3D[][]
    selections2: Object3D[][]
    selections3: Object3D[][]
    selectionLayer: number
  }>

export const Outline = React.forwardRef(function Outline(
  {
    selections1 = [],
    selections2 = [],
    selections3 = [],
    selectionLayer = 10,
    edgeStrength,
    edgeColor1,
    edgeColor2,
    edgeColor3,
    width,
    height,
    kernelSize,
    ...props
  }: OutlineProps,
  forwardRef: React.Ref<OutlineEffect>
) {
  const invalidate = useThree((state) => state.invalidate)
  const { scene, camera } = useThree()

  const effect = React.useMemo(
    () =>
      new OutlineEffect(scene, camera, {
        edgeStrength,
        edgeColor1,
        edgeColor2,
        edgeColor3,
        width,
        height,
        kernelSize,
      }),
    [scene, camera, edgeStrength, edgeColor1, edgeColor2, edgeColor3, width, height, kernelSize]
  )

  React.useEffect(() => {
    if (selections1) {
      effect.selections1 = selections1.map(selection => new Selection(selection, selectionLayer))
      invalidate()

      return () => {
        effect.selections1.forEach(selection => selection.clear())
        effect.selections1 = []
        invalidate()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect, selections1])

  React.useEffect(() => {
    if (selections2) {
      effect.selections2 = selections2.map(selection => new Selection(selection, selectionLayer))
      invalidate()

      return () => {
        effect.selections2.forEach(selection => selection.clear())
        effect.selections2 = []
        invalidate()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect, selections2])

  React.useEffect(() => {
    if (selections3) {
      effect.selections3 = selections3.map(selection => new Selection(selection, selectionLayer))
      invalidate()

      return () => {
        effect.selections3.forEach(selection => selection.clear())
        effect.selections3 = []
        invalidate()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect, selections3])

  React.useEffect(() => {
    effect.selectionLayer = selectionLayer
    invalidate()
  }, [effect, selectionLayer, invalidate])

  return <primitive ref={forwardRef} object={effect} />
})
