import * as THREE from 'three'
import React from 'react'
import { Geometry } from 'three-stdlib'

import { extend, useFrame, useThree, createPortal } from '@react-three/fiber'

extend({ Geometry })

const lineMaterial = new THREE.LineBasicMaterial({ color: 0x111111 })

const RectLine: React.FC<{ start: THREE.Vector3; end: THREE.Vector3 }> = ({ start, end }) => {
  const geometry = React.useMemo(() => new THREE.BufferGeometry().setFromPoints([start, end]), [start, end])

  return <line_ material={lineMaterial} geometry={geometry} />
}

export const RectLines: React.FC<{ clickPos: THREE.Vector2; curPos: THREE.Vector2 }> = ({ clickPos, curPos }) => {
  const { gl, size } = useThree()

  const virtualScene = React.useMemo(() => new THREE.Scene(), [])
  const virtualCam = React.useMemo(() => new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000), [])

  React.useEffect(() => {
    virtualCam.position.z = 100
    virtualCam.left = size.width / -2
    virtualCam.right = size.width / 2
    virtualCam.top = size.height / 2
    virtualCam.bottom = size.height / -2
    virtualCam.updateProjectionMatrix()
  }, [virtualCam, size])

  useFrame(() => {
    gl.autoClear = false
    gl.clearDepth()
    gl.render(virtualScene, virtualCam)
  }, 2)

  // No need to memoize this since it'd be triggered on every rerender anyway
  const x1 = ((clickPos.x + 1) * size.width) / 2
  const y1 = ((clickPos.y + 1) * size.height) / 2
  const x2 = ((curPos.x + 1) * size.width) / 2
  const y2 = ((curPos.y + 1) * size.height) / 2

  const p1 = new THREE.Vector3(x1, y1, 0)
  const p2 = new THREE.Vector3(x2, y1, 0)
  const p3 = new THREE.Vector3(x1, y2, 0)
  const p4 = new THREE.Vector3(x2, y2, 0)

  return (
    createPortal(
      <group position={[-size.width / 2, -size.height / 2, 0]}>
        <RectLine start={p1} end={p2} />
        <RectLine start={p1} end={p3} />
        <RectLine start={p2} end={p4} />
        <RectLine start={p3} end={p4} />
      </group>,
      virtualScene,
    )
  )
}
