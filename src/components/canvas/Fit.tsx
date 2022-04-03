import { DrawingID, GeometryBounds } from '@buerli.io/core'
import { useBuerli, useDrawing } from '@buerli.io/react'
import { useIsLoading } from '@buerli.io/react-cad'
import { Bounds, SizeProps, useBounds } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import React from 'react'

/**
 * Fit to scene bounds if the ClassCAD geometry bounds changed.
 */
function Refresh({ ccBounds }: { ccBounds: GeometryBounds }) {
  const bounds = useBounds()

  React.useEffect(() => {
    bounds?.refresh().clip().fit()
  }, [bounds, ccBounds])

  return null
}

/**
 * Fit to scene bounds after the active drawing changed.
 */
function SwitchDrawing() {
  const bounds = useBounds()
  const currDrId = useBuerli(b => b.drawing.active) || ''

  React.useEffect(() => {
    bounds?.refresh().clip().fit()
  }, [bounds, currDrId])

  return null
}

/**
 * Fit to scene bounds if the user double clicks the Canvas.
 */
function DblClick() {
  const bounds = useBounds()
  const gl = useThree(state => state.gl)

  React.useEffect(() => {
    function onDoubleClick() {
      bounds?.refresh().clip().fit()
    }
    gl.domElement.addEventListener('dblclick', onDoubleClick, { passive: true })
    return () => {
      gl.domElement.removeEventListener('dblclick', onDoubleClick)
    }
  }, [bounds, gl.domElement])

  return null
}

/**
 * Fits three scene to its bounds.
 */
export function Fit({
  drawingId,
  children,
  onFit,
}: {
  drawingId: DrawingID
  children?: React.ReactNode
  onFit?: (bounds: SizeProps) => void
}) {
  const isLoading = useIsLoading(drawingId)
  const ccBounds = useDrawing(drawingId, d => d.geometry.bounds) as GeometryBounds

  return (
    <Bounds onFit={onFit}>
      {children}
      <DblClick />
      <SwitchDrawing />
      {isLoading && <Refresh ccBounds={ccBounds} />}
    </Bounds>
  )
}
