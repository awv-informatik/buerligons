import { ReactThreeFiber, useFrame, useThree } from '@react-three/fiber'
import * as React from 'react'
import * as THREE from 'three'
import { StageControls } from './StageControls'

export type ControlsProps = Partial<
  Pick<StageControls, 'enabled' | 'rotateSpeed' | 'zoomSpeed' | 'noRotate' | 'noZoom' | 'noPan' | 'minZoom' | 'maxZoom'>
> & {
  target?: ReactThreeFiber.Vector3
  /** The model's middle: what a drag that begins beside the model turns about. */
  center?: () => THREE.Vector3 | null
  camera?: THREE.Camera
  regress?: boolean
  makeDefault?: boolean
  onChange?: (e?: THREE.Event) => void
  onStart?: (e?: THREE.Event) => void
  onEnd?: (e?: THREE.Event) => void
}

// What a drag can turn about: what is drawn where the pointer is. Not what is only there to take
// the pointer (a trigger, a plane that is not shown), and not what lies on top of the stage.
const isDrawn = (object: THREE.Object3D) => {
  const drawn = object as THREE.Mesh & { isLine?: boolean; isPoints?: boolean }
  if (!drawn.isMesh && !drawn.isLine && !drawn.isPoints) return false
  if (drawn.userData?.onHUD) return false
  const material = Array.isArray(drawn.material) ? drawn.material[0] : drawn.material
  if (!material || !material.visible || !material.colorWrite || material.opacity === 0) return false
  for (let o: THREE.Object3D | null = drawn; o; o = o.parent) if (!o.visible) return false
  return true
}

/** The stage's camera control (see StageControls), as the canvas' default controls. */
// eslint-disable-next-line react/display-name
export const Controls = React.forwardRef<StageControls, ControlsProps>(
  ({ makeDefault, camera, regress, center, onChange, onStart, onEnd, ...restProps }, ref) => {
    const { invalidate, camera: defaultCamera, gl, set, get, performance } = useThree()
    const explCamera = camera || defaultCamera
    const explDomElement = gl.domElement
    const controls = React.useMemo(() => new StageControls(explCamera), [explCamera])

    useFrame(() => {
      if (controls.enabled) controls.update()
    }, -1)

    React.useEffect(() => {
      controls.pick = ndc => {
        const { raycaster, scene } = get()
        raycaster.setFromCamera(ndc, explCamera)
        const hit = raycaster.intersectObjects(scene.children, true).find(h => isDrawn(h.object))
        return hit ? hit.point : null
      }
      controls.center = center ?? null
    }, [controls, explCamera, get, center])

    React.useEffect(() => {
      const callback = (e: THREE.Event) => {
        invalidate()
        if (regress) performance.regress()
        if (onChange) onChange(e)
      }

      controls.connect(explDomElement)
      controls.addEventListener('change', callback)
      if (onStart) controls.addEventListener('start', onStart)
      if (onEnd) controls.addEventListener('end', onEnd)

      return () => {
        controls.removeEventListener('change', callback)
        if (onStart) controls.removeEventListener('start', onStart)
        if (onEnd) controls.removeEventListener('end', onEnd)
        controls.dispose()
      }
    }, [explDomElement, onChange, onStart, onEnd, regress, controls, invalidate, performance])

    React.useEffect(() => {
      if (makeDefault) {
        const old = get().controls
        set({ controls: controls as any })
        return () => set({ controls: old })
      }
    }, [makeDefault, controls, get, set])

    return <primitive ref={ref} object={controls} {...restProps} />
  },
)
