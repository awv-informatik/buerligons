import { create } from 'zustand'

/**
 * How a surface looks, as three.js's MeshPhysicalMaterial takes it (colours as `#rrggbb`). The PDM's appearance
 * library names its fields the same way, so a look is copied onto the material property by property.
 */
export interface Look {
  color?: string
  metalness?: number
  roughness?: number
  opacity?: number
  envMapIntensity?: number
  clearcoat?: number
  clearcoatRoughness?: number
  anisotropy?: number
  anisotropyRotation?: number
  emissive?: string
  emissiveIntensity?: number
  transmission?: number
  ior?: number
  thickness?: number
  specularIntensity?: number
  specularColor?: string
  sheen?: number
  sheenColor?: string
}

const PBR_KEY = 'buerligons.pbr'

const remembered = (): boolean => {
  try {
    return localStorage.getItem(PBR_KEY) === 'on'
  } catch {
    return false
  }
}

interface LooksState {
  /** The realistic view: physical materials and an environment instead of the flat Lambert shading. Remembered. */
  pbr: boolean
  /** The look of each product by its name (a part's name, a template ident in an assembly). */
  looks: Record<string, Look>
  setPbr: (on: boolean) => void
  togglePbr: () => void
  /** Replaces the looks (a host sets them after it opened a document). */
  setLooks: (looks: Record<string, Look>) => void
}

export const useLooks = create<LooksState>((set, get) => ({
  pbr: remembered(),
  looks: {},
  setPbr: on => {
    try {
      localStorage.setItem(PBR_KEY, on ? 'on' : 'off')
    } catch {
      // a browser without storage forgets the choice, nothing else
    }
    set({ pbr: on })
  },
  togglePbr: () => get().setPbr(!get().pbr),
  setLooks: looks => set({ looks }),
}))

export const setLooks = (looks: Record<string, Look>) => useLooks.getState().setLooks(looks)
export const setPbr = (on: boolean) => useLooks.getState().setPbr(on)
