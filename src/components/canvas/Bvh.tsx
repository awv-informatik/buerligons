import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { useThree } from '@react-three/fiber'
import * as React from 'react'
import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'

export interface BVHOptions {
  /** Split strategy, default: SAH (slowest to construct, fastest runtime, least memory) */
  splitStrategy?: 'CENTER' | 'AVERAGE' | 'SAH'
  /** Print out warnings encountered during tree construction, default: false */
  verbose?: boolean
  /** If true then the bounding box for the geometry is set once the BVH has been constructed, default: true */
  setBoundingBox?: boolean
  /** The maximum depth to allow the tree to build to, default: 40 */
  maxDepth?: number
  /** The number of triangles to aim for in a leaf node, default: 10 */
  maxLeafTris?: number
}

export type BvhProps = BVHOptions &
  JSX.IntrinsicElements['group'] & {
    drawingId: DrawingID
    /**Enabled, default: true */
    enabled?: boolean
    /** Use .raycastFirst to retrieve hits which is generally faster, default: false */
    firstHitOnly?: boolean
  }

export function Bvh({
  drawingId,
  enabled = true,
  firstHitOnly = false,
  children,
  splitStrategy = 'SAH',
  verbose = false,
  setBoundingBox = true,
  maxDepth = 40,
  maxLeafTris = 10,
  ...props
}: BvhProps) {
  const ref = React.useRef<THREE.Group>(null!)
  const raycaster = useThree(state => state.raycaster)

  // Trigger when new geometries have been added
  const ccBounds = useDrawing(drawingId, d => d.geometry.stamp)

  React.useEffect(() => {
    if (enabled) {
      const options = { splitStrategy, verbose, setBoundingBox, maxDepth, maxLeafTris }
      const group = ref.current
      // This can only safely work if the component is used once, but there is no alternative.
      // Hijacking the raycast method to do it for individual meshes is not an option as it would
      // cost too much memory ...
      ;(raycaster as any).firstHitOnly = firstHitOnly
      group.traverse((child: any) => {
        // Only include meshes that do not yet have a boundsTree and whose raycast is standard issue
        if (child.isMesh && !child.geometry.boundsTree && child.raycast === THREE.Mesh.prototype.raycast) {
          child.raycast = acceleratedRaycast
          child.geometry.computeBoundsTree = computeBoundsTree
          child.geometry.disposeBoundsTree = disposeBoundsTree
          child.geometry.computeBoundsTree(options)
        }
      })
      return () => {
        delete (raycaster as any).firstHitOnly
        group.traverse((child: any) => {
          if (child.isMesh && child.geometry.boundsTree) {
            child.geometry.disposeBoundsTree()
            child.raycast = THREE.Mesh.prototype.raycast
          }
        })
      }
    }
  })
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  )
}
