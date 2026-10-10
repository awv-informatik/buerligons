// The PMI exchange document of a part as `api.v1.pmi.get` returns it (ClassCAD CC_PmiSet.ToDocument),
// with the display block of Phase 4a (default anchors and text positions computed on the server).

export type Vec3 = { x: number; y: number; z: number }

export type PmiStatus = 'valid' | 'check' | 'unresolved' | 'imported' | string

export type PmiDisplay = {
  anchor?: Vec3
  anchors?: Vec3[]
  dir?: Vec3
  textPos?: Vec3
}

export type PmiElement = { id: number; reference: number; status: string }

export type PmiFeature = {
  id: number
  name: string
  status: PmiStatus
  kind: string
  elementType: string
  geometryType: string
  elements: PmiElement[]
  parents: number[]
  display?: PmiDisplay
}

export type PmiDatum = {
  id: number
  name: string
  status: PmiStatus
  letter: string
  feature: number
  display?: PmiDisplay
}

export type PmiDimensionValue = {
  type: 'none' | 'plusMinus' | 'limits' | 'isoClass' | string
  upper: number
  lower: number
  upperLimit: number
  lowerLimit: number
  isoClass?: string
}

export type PmiDimension = {
  id: number
  name: string
  status: PmiStatus
  kind: 'size' | 'location' | string
  type: string
  features: number[]
  nominal: number
  value: PmiDimensionValue
  qualifier: string
  modifiers: string[]
  envelope: boolean
  display?: PmiDisplay
}

export type PmiCompartment = { datums: string[]; modifiers: string[] }

export type PmiTolerance = {
  id: number
  name: string
  status: PmiStatus
  type: string
  group?: string
  feature?: number
  magnitude: number
  zone: { form: string; cylindrical: boolean; projectedLength?: number; unequalDisplacement?: number }
  modifiers: string[]
  maxTolerance?: number
  datumSystem: PmiCompartment[]
  display?: PmiDisplay
}

export type PmiDocument = {
  version: number
  standard: string
  decimals: number
  part?: number
  partName?: string
  display?: { center: Vec3; size: number }
  features: PmiFeature[]
  datums: PmiDatum[]
  dimensions: PmiDimension[]
  tolerances: PmiTolerance[]
}

/** One row of the inspection table / one annotation in the view. */
export type PmiEntry =
  | { kind: 'datum'; item: PmiDatum }
  | { kind: 'dimension'; item: PmiDimension }
  | { kind: 'tolerance'; item: PmiTolerance }

export type PmiPluginState = {
  /** annotations shown in the 3D view */
  showAnnotations: boolean
  /** the item (datum, dimension, tolerance) under the mouse, in the table or in the view */
  hovered: number | null
  /** the item picked in the table or in the view */
  selected: number | null
}
