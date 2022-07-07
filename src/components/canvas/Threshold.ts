import { CameraHelper } from '@buerli.io/react'
import { useFrame, useThree } from '@react-three/fiber'
import React from 'react'

type Props = { lineWidth?: number; pointSize?: number }

export const Threshold: React.FC<Props> = props => {
  const { lineWidth = 4, pointSize = 6 } = props
  const { camera, raycaster, size } = useThree()

  const updateRaycasterSettings = React.useCallback(() => {
    Object.assign(raycaster.params.Line || {}, {
      threshold: CameraHelper.calculateScaleFactor(camera.position, lineWidth, camera, size),
    })
    Object.assign(raycaster.params.Points || {}, {
      threshold: CameraHelper.calculateScaleFactor(camera.position, pointSize, camera, size),
    })
  }, [camera, lineWidth, pointSize, raycaster.params.Line, raycaster.params.Points, size])

  useFrame(updateRaycasterSettings)

  return null
}
