import React from 'react'
import * as THREE from 'three'

import { GizmoHelper, GizmoViewcube, GizmoViewport, useBounds } from '@react-three/drei'
import { ThreeEvent, useThree } from '@react-three/fiber'

type ControlsProto = {
  update(): void
  target: THREE.Vector3
}

const tolerance = 1e-6
const upDefault = new THREE.Vector3(0, 0, 1)

const getUpVector = (normal: THREE.Vector3) => {
  // Any edge or corner
  if (Math.abs(Math.abs(normal.x + normal.y + normal.z) - 1) > tolerance) {
    return normal.clone().cross(upDefault).cross(normal).normalize()
  }
  if (Math.abs(normal.y + 1) < tolerance) {
    // Front
    return new THREE.Vector3(0, 0, 1)
  }
  if (Math.abs(normal.y - 1) < tolerance) {
    // Back
    return new THREE.Vector3(0, 0, -1)
  }

  // Top, Bottom, Left, Right
  return new THREE.Vector3(0, 1, 0)
}

export const ViewCube: React.FC<{}> = ({}) => {
  const bounds = useBounds()

  const { camera, invalidate } = useThree()
  const controls = useThree(s => s.controls as unknown as ControlsProto)

  const onClick = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()

    let normal: THREE.Vector3
    if (e.object.position.lengthSq() === 0) {
      normal = e.face?.normal || new THREE.Vector3()
    }
    else {
      normal = e.object.position.clone().normalize()
    }
    const up = getUpVector(normal)
    const target = controls.target.clone()
    const distance = camera.position.distanceTo(target)
    const position = target.clone().addScaledVector(normal, distance)

    bounds?.refresh().moveTo(position).lookAt({ target, up })

    invalidate()

    // Idk why GizmoViewcube's onClick is typed to have to return null...
    return null
  }, [bounds, camera, controls, invalidate])

  return (
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
          onClick={onClick}
        />
      </group>
    </GizmoHelper>
  )
}
