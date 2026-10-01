import { useFrame, useThree } from '@react-three/fiber'
import React from 'react'
import * as THREE from 'three'

type ControlsProto = { target: THREE.Vector3 }

// where the lamp sits, as the reader sees it: over their left shoulder
const SHOULDER = new THREE.Vector3(-0.55, 0.75, 1)
const offset = new THREE.Vector3()

/**
 * The stage's light. Its job is to make a body read as solid and to say which way a face looks:
 * an even ground light, and one lamp that stays over the reader's shoulder however the part is
 * turned. The face that looks at the lamp is the body's own tone, the ones that turn away fall
 * off to about two thirds of it: three faces of a block are three clearly different greys.
 */
export function Lights() {
  const lamp = React.useRef<THREE.DirectionalLight>(null!)
  const controls = useThree(state => state.controls as unknown as ControlsProto | null)

  useFrame(({ camera }) => {
    if (!lamp.current) return
    const target = controls?.target ?? lamp.current.target.position
    const distance = Math.max(camera.position.distanceTo(target), 1)
    offset.copy(SHOULDER).normalize().multiplyScalar(distance).applyQuaternion(camera.quaternion)
    lamp.current.position.copy(target).add(offset)
    lamp.current.target.position.copy(target)
    lamp.current.target.updateMatrixWorld()
  }, -2)

  return (
    <>
      <ambientLight intensity={0.68} />
      <directionalLight ref={lamp} intensity={0.42} />
    </>
  )
}

export default Lights
