import * as THREE from 'three'
import React from 'react'

import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { extend, Intersection, Object3DNode, ThreeEvent } from '@react-three/fiber'
import { FilterFunction } from '@react-three/fiber/dist/declarations/src/core/store'

class InteractionObj extends THREE.Object3D {
  public raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    const res = {
      distance: 0,
      distanceToRay: 0,
      point: raycaster.ray.origin.clone(),
      index: 0,
      face: null,
      object: this,
    }
    intersects.push(res)
    /* intersects.splice(0, 0, res) */
  }
}

extend({ InteractionObj })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      interactionObj: Object3DNode<InteractionObj, typeof InteractionObj>
    }
  }
}

const getValidIntersections = (intersections: Intersection[], cbName: string) => {
  return intersections
    .filter(intersection => (intersection.eventObject as any).__r3f.handlers[cbName] && !(intersection.eventObject instanceof InteractionObj))
    .sort((a, b) => {
      if (a.eventObject.userData?.onHUD && !b.eventObject.userData?.onHUD) {
        return -1
      }
      if (!a.eventObject.userData?.onHUD && b.eventObject.userData?.onHUD) {
        return 1
      }

      return a.distance - b.distance
    })
}

const getValidEvent = (e: ThreeEvent<MouseEvent>, intersection: Intersection) => {
  return {
    ...e,
    ...intersection
  }
}

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

export const ViewInteraction: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const activeSelId = useDrawing(drawingId, d => d.selection.active)

  const intersectionPrev = React.useRef<Intersection>()

  const onPointerMove = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()

    const intersections = getValidIntersections(e.intersections, 'onPointerMove')
    const first = intersections[0]

    ;(first?.eventObject as any)?.__r3f.handlers.onPointerMove?.(getValidEvent(e, intersections[0]))

    /* if (first?.eventObject !== intersectionPrev.current?.eventObject) {
      (intersectionPrev.current?.eventObject as any)?.__r3f.handlers.onPointerOut?.(getValidEvent(e, intersectionPrev.current as Intersection))
      (first?.eventObject as any)?.__r3f.handlers.onPointerOver?.(getValidEvent(e, first))

      intersectionPrev.current = first
    } */
  }, [])

  const onClick = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()

    const intersections = getValidIntersections(e.intersections, 'onClick')
    ;(intersections[0]?.eventObject as any)?.__r3f.handlers.onClick?.(getValidEvent(e, intersections[0]))
  }, [])

  const onPointerDown = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()

    const intersections = getValidIntersections(e.intersections, 'onPointerDown')
    ;(intersections[0]?.eventObject as any)?.__r3f.handlers.onPointerDown?.(getValidEvent(e, intersections[0]))
  }, [])

  const onPointerUp = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()

    const intersections = getValidIntersections(e.intersections, 'onPointerUp')
    ;(intersections[0]?.eventObject as any)?.__r3f.handlers.onPointerUp?.(getValidEvent(e, intersections[0]))
  }, [])

  return <interactionObj onPointerMove={onPointerMove} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp} renderOrder={10000} />
}
