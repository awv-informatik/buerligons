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
  /** the design dimension whose tolerance form is open (from the context menu of a sketch dimension) */
  promoteTarget?: number | null
  /** the creation form that is open (from the context menu of a face): what to make and on which faces */
  create?: PmiCreateRequest | null
}

export type PmiCreateMode = 'datum' | 'dimension' | 'tolerance'

export type PmiCreateRequest = {
  mode: PmiCreateMode
  /** faces: element id (= graphic id) and surface type */
  elements: { id: number; surface: string }[]
}

/** The window title of the plugin, also used to find it among the global plugins. */
export const PMI_PLUGIN_NAME = 'GD&T'

/** A design dimension of the part as `api.v1.pmi.listDesignDimensions` returns it. */
export type DesignDimension = {
  /** the sketch dimension constraint or the extrusion */
  id: number
  name: string
  /** the sketch or the feature it belongs to */
  owner: string
  kind: 'sketch' | 'feature'
  value: number
  /** what promotion makes of it (PMI dimension type); missing when it cannot be promoted yet */
  type?: string
  /** why it cannot be promoted yet */
  reason?: string
  /** the PMI dimension that stands for it */
  promoted?: number
  promotedName?: string
}
