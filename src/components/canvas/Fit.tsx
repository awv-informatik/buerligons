import { DrawingID, GeometryBounds } from '@buerli.io/core'
import { CameraHelper, useBuerli, useDrawing } from '@buerli.io/react'
import { Bounds, useBounds } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
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
  lineWidth = 3,
  pointSize = 6,
}: {
  drawingId: DrawingID
  children?: React.ReactNode
  lineWidth?: number
  pointSize?: number
}) {
  const ccBounds = useDrawing(drawingId, d => d.geometry.bounds) as GeometryBounds
  const { camera, raycaster, size } = useThree()

  const updateRaycasterSettings = React.useCallback(() => {
    Object.assign(raycaster.params.Line, {
      threshold: CameraHelper.calculateScaleFactor(camera.position, lineWidth / 2.0, camera, size),
    })
    Object.assign(raycaster.params.Points, {
      threshold: CameraHelper.calculateScaleFactor(camera.position, pointSize, camera, size),
    })
  }, [camera, lineWidth, pointSize, raycaster.params.Line, raycaster.params.Points, size])

  useFrame(updateRaycasterSettings)

  return (
    <Bounds>
      {children}
      <DblClick />
      <SwitchDrawing />
      <Refresh ccBounds={ccBounds} />
    </Bounds>
  )
}
