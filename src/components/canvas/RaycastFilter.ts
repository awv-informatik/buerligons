import { FilterFunction } from "@react-three/fiber/dist/declarations/src/core/events"

export const raycastFilter: FilterFunction = (intersects, state) => {
  const minDist = intersects[0]?.distance
  const sorted = [...intersects].sort(
    (a, b) => {
      if (a.object.userData?.onHUD && !b.object.userData?.onHUD) {
        return -1
      }
      if (!a.object.userData?.onHUD && b.object.userData?.onHUD) {
        return 1
      }

      const threshold = state.raycaster.params.Line?.threshold ?? 1
      if (Math.abs(minDist - a.distance) <= threshold && Math.abs(minDist - b.distance) <= threshold) {
        return b.object.renderOrder - a.object.renderOrder
      }
      
      return a.distance - b.distance
    })
  return sorted
}
