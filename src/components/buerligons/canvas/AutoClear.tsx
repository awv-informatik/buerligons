import { useFrame, useThree } from '@react-three/fiber'

export function AutoClear() {
  const { gl, scene, camera } = useThree()
  // Takes over render queue so that we can autoclear the scene, this allows
  // Plugins to draw on top of it for their own purposes
  useFrame(() => {
    gl.autoClear = true
    gl.render(scene, camera)
  }, 1)
  return null
}

export default AutoClear
