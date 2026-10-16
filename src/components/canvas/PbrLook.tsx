import { DrawingID, getDrawing } from '@buerli.io/core'
import { Environment, Lightformer } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import React from 'react'
import * as THREE from 'three'

import { Look, useLooks } from '../../looks'

/** What a swapped mesh remembers: the Lambert material the geometry gave it, and the physical one shown instead. */
interface Swap {
  lambert: THREE.MeshLambertMaterial
  physical: THREE.MeshPhysicalMaterial
  /** The look last applied, to apply a changed one. */
  look: Look | null
  /** What was applied: 'plain' once the defaults are on, then the fields the look named. */
  set: string[]
}

type Swapped = THREE.Mesh & { userData: { pbr?: Swap; productId?: number; containerId?: number } }

/** Without a look a face reads about as it does in Lambert: a dull, slightly reflective surface. */
const PLAIN: Required<Pick<Look, 'metalness' | 'roughness' | 'envMapIntensity'>> = { metalness: 0.05, roughness: 0.6, envMapIntensity: 0.5 }

const SCALARS = [
  'metalness',
  'roughness',
  'envMapIntensity',
  'clearcoat',
  'clearcoatRoughness',
  'anisotropy',
  'emissiveIntensity',
  'transmission',
  'ior',
  'thickness',
  'specularIntensity',
  'sheen',
] as const
const COLORS = ['emissive', 'specularColor', 'sheenColor'] as const

const DEFAULTS: Record<(typeof SCALARS)[number] | (typeof COLORS)[number], number | string> = {
  metalness: PLAIN.metalness,
  roughness: PLAIN.roughness,
  envMapIntensity: PLAIN.envMapIntensity,
  clearcoat: 0,
  clearcoatRoughness: 0,
  anisotropy: 0,
  emissiveIntensity: 1,
  transmission: 0,
  ior: 1.5,
  thickness: 0,
  specularIntensity: 1,
  sheen: 0,
  emissive: '#000000',
  specularColor: '#ffffff',
  sheenColor: '#ffffff',
}

/** The Lambert material's own state onto the physical one: colour and opacity from the model, the rest as set. */
function sync(swap: Swap) {
  const { lambert, physical } = swap
  physical.color.copy(lambert.color)
  physical.opacity = lambert.opacity
  physical.transparent = lambert.transparent
  physical.side = lambert.side
  physical.visible = lambert.visible
  physical.depthWrite = lambert.depthWrite
  physical.polygonOffset = lambert.polygonOffset
  physical.polygonOffsetFactor = lambert.polygonOffsetFactor
  physical.polygonOffsetUnits = lambert.polygonOffsetUnits
  physical.colorWrite = lambert.colorWrite
}

/** The look onto the physical material: every field it names, and back to the default for fields it dropped. */
function apply(swap: Swap, look: Look | null) {
  if (look === swap.look && swap.set.length) return
  const physical = swap.physical as unknown as Record<string, unknown>
  const named = new Set<string>()
  // Everything starts from the plain surface; the look then names what it changes.
  for (const key of SCALARS) physical[key] = DEFAULTS[key]
  for (const key of COLORS) (physical[key] as THREE.Color).set(DEFAULTS[key] as string)
  physical.anisotropyRotation = 0
  for (const key of SCALARS) {
    const value = look?.[key]
    if (typeof value === 'number') {
      physical[key] = value
      named.add(key)
    }
  }
  for (const key of COLORS) {
    const value = look?.[key]
    if (typeof value === 'string') {
      ;(physical[key] as THREE.Color).set(value)
      named.add(key)
    }
  }
  if (typeof look?.anisotropyRotation === 'number') {
    physical.anisotropyRotation = (look.anisotropyRotation * Math.PI) / 180
    named.add('anisotropyRotation')
  }
  // Transmission needs an opaque material to refract through; plain transparency keeps the blend.
  swap.physical.transparent = swap.lambert.transparent && !(look?.transmission && look.transmission > 0)
  swap.physical.needsUpdate = true
  swap.look = look
  swap.set = ['plain', ...named]
}

/**
 * The realistic view (doc/materialdatenbank.md, "Aussehen"): an environment to reflect, and every face drawn with a
 * physical material instead of the Lambert one `@buerli.io/react` gives it. The Lambert material stays on the mesh's
 * record and comes back when the view is switched off; colour and opacity follow it, the rest comes from the look of
 * the product (by its name, as the host set it) or a plain default. `frameloop` is on demand: the pass runs on every
 * drawn frame and asks for one more when it changed something.
 */
export function PbrLook({ drawingId }: { drawingId: DrawingID }) {
  const pbr = useLooks(s => s.pbr)
  const looks = useLooks(s => s.looks)
  const scene = useThree(s => s.scene)
  const invalidate = useThree(s => s.invalidate)
  const swaps = React.useRef(new Map<THREE.Mesh, Swap>())

  // Switched off: every mesh gets its Lambert material back, the physical ones are let go.
  React.useEffect(() => {
    if (pbr) return
    for (const [mesh, swap] of swaps.current) {
      if (mesh.material === swap.physical) mesh.material = swap.lambert
      swap.physical.dispose()
    }
    swaps.current.clear()
    invalidate()
  }, [pbr, invalidate])

  // A new set of looks is applied on the next frame.
  React.useEffect(() => invalidate(), [looks, invalidate])

  useFrame(() => {
    if (!pbr) return
    let changed = false
    const seen = new Set<THREE.Mesh>()
    const tree = getDrawing(drawingId)?.structure.tree as Record<number, { name?: string } | undefined> | undefined
    scene.traverse(object => {
      const mesh = object as Swapped
      if (!(mesh as THREE.Mesh).isMesh || mesh.userData.containerId === undefined) return
      let swap = swaps.current.get(mesh)
      const material = mesh.material as THREE.Material
      if (!swap || (material !== swap.physical && material !== swap.lambert)) {
        if (!(material as THREE.MeshLambertMaterial).isMeshLambertMaterial) return
        if (swap) swap.physical.dispose()
        swap = { lambert: material as THREE.MeshLambertMaterial, physical: new THREE.MeshPhysicalMaterial(), look: null, set: [] }
        sync(swap)
        apply(swap, null)
        swaps.current.set(mesh, swap)
        changed = true
      } else if (material === swap.lambert) {
        changed = true
      } else {
        sync(swap)
      }
      seen.add(mesh)
      mesh.material = swap.physical
      const name = mesh.userData.productId !== undefined ? tree?.[mesh.userData.productId]?.name : undefined
      const look = (name && looks[name]) || null
      if (look !== swap.look) {
        apply(swap, look)
        changed = true
      }
    })
    for (const [mesh, swap] of swaps.current) {
      if (seen.has(mesh)) continue
      swap.physical.dispose()
      swaps.current.delete(mesh)
    }
    if (changed) invalidate()
  }, -1)

  if (!pbr) return null
  return (
    <Environment resolution={256} frames={1}>
      {/* a studio: an even grey all around so that metal never goes black, a wide soft key from above left, a
          cooler fill from the right, a strip from behind for rims, a lighter floor */}
      <color attach="background" args={['#787e85']} />
      <Lightformer intensity={1.6} form="rect" position={[-5, 6, 4]} scale={[8, 4, 1]} target={[0, 0, 0]} />
      <Lightformer intensity={0.9} form="rect" position={[6, 2, 2]} scale={[4, 6, 1]} target={[0, 0, 0]} color="#dfe8f2" />
      <Lightformer intensity={0.7} form="rect" position={[0, 3, -7]} scale={[10, 2, 1]} target={[0, 0, 0]} />
      <Lightformer intensity={0.5} form="rect" position={[0, -6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[14, 14, 1]} color="#b8bec4" />
    </Environment>
  )
}

export default PbrLook
