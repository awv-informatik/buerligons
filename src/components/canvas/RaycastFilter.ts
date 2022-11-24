import { FilterFunction } from '@react-three/fiber/dist/declarations/src/core/store'

export const raycastFilter: FilterFunction = (intersects, state) => {
  const sorted = [...intersects].sort(
    (a, b) => {
      if (a.object.userData?.onHUD && !b.object.userData?.onHUD) {
        return -1
      }
      if (!a.object.userData?.onHUD && b.object.userData?.onHUD) {
        return 1
      }
      
      return a.distance - b.distance
    })
  return sorted
}
