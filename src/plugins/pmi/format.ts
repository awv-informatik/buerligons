import { PmiDimension, PmiDocument, PmiEntry, PmiFeature, PmiStatus, PmiTolerance } from './types'

/** A number with at most `decimals` decimals, trailing zeros removed (12.000 -> 12, 0.050 -> 0.05). */
export const formatNumber = (value: number | undefined, decimals = 3): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return ''
  const rounded = Number(value.toFixed(Math.max(decimals, 3)))
  return rounded.toString()
}

const signed = (value: number, decimals: number) => {
  if (Math.abs(value) < 1e-12) return '0'
  return (value > 0 ? '+' : '') + formatNumber(value, decimals)
}

const dimensionPrefix: Record<string, string> = {
  diameter: '⌀',
  sphericalDiameter: 'S⌀',
  radius: 'R',
  sphericalRadius: 'SR',
}

const isAngular = (type: string) => type === 'angular' || type === 'angularSize'

/** The parts of a dimension label: main text, and an optional upper/lower pair shown stacked. */
export type DimensionText = { main: string; upper?: string; lower?: string; basic: boolean; reference: boolean }

export const formatDimension = (dim: PmiDimension, decimals = 3): DimensionText => {
  const prefix = dimensionPrefix[dim.type] ?? ''
  const unit = isAngular(dim.type) ? '°' : ''
  const nominal = prefix + formatNumber(dim.nominal, decimals) + unit
  const basic = dim.qualifier === 'basic'
  const reference = dim.qualifier === 'reference'
  const v = dim.value
  if (!v || v.type === 'none' || basic || reference) return { main: nominal, basic, reference }
  if (v.type === 'isoClass' && v.isoClass) {
    return { main: `${nominal} ${v.isoClass}`, upper: signed(v.upper, decimals), lower: signed(v.lower, decimals), basic, reference }
  }
  if (v.type === 'limits') {
    return {
      main: '',
      upper: formatNumber(v.upperLimit, decimals) + unit,
      lower: formatNumber(v.lowerLimit, decimals) + unit,
      basic,
      reference,
    }
  }
  if (Math.abs(v.upper + v.lower) < 1e-12) {
    return { main: `${nominal} ±${formatNumber(v.upper, decimals)}${unit}`, basic, reference }
  }
  return { main: nominal, upper: signed(v.upper, decimals) + unit, lower: signed(v.lower, decimals) + unit, basic, reference }
}

/** Modifier names of the PMI model -> the character drawn in the frame (circled letters per ISO 1101). */
const modifierGlyph: Record<string, string> = {
  MAXIMUM_MATERIAL_REQUIREMENT: 'Ⓜ',
  MMR: 'Ⓜ',
  MMC: 'Ⓜ',
  LEAST_MATERIAL_REQUIREMENT: 'Ⓛ',
  LMR: 'Ⓛ',
  LMC: 'Ⓛ',
  RECIPROCITY_REQUIREMENT: 'Ⓡ',
  RPR: 'Ⓡ',
  FREE_STATE: 'Ⓕ',
  TANGENT_PLANE: 'Ⓣ',
  STATISTICAL_TOLERANCE: '⟨ST⟩',
  COMMON_ZONE: 'CZ',
  SEPARATE_REQUIREMENT: 'SEP REQT',
  ANY_CROSS_SECTION: 'ACS',
  ACS: 'ACS',
  ANY_LONGITUDINAL_SECTION: 'ALS',
  ALS: 'ALS',
  LINE_ELEMENT: 'LE',
  NOT_CONVEX: 'NC',
  CONTACTING_FEATURE: 'CF',
  PITCH_DIAMETER: 'PD',
  MAJOR_DIAMETER: 'MD',
  MINOR_DIAMETER: 'LD',
  EACH_RADIAL_ELEMENT: 'ERE',
  BASIC: '[BSC]',
  TRANSLATION: '▷',
  DISTANCE_VARIABLE: 'DV',
}

export const formatModifier = (name: string) => modifierGlyph[name] ?? name.toLowerCase().replace(/_/g, ' ')

/** The cells of a feature control frame after the symbol: tolerance cell and datum cells. */
export type FrameCells = { tolerance: string; datums: string[] }

export const formatFrame = (tol: PmiTolerance, decimals = 3): FrameCells => {
  let tolerance = (tol.zone?.cylindrical ? '⌀' : '') + formatNumber(tol.magnitude, decimals)
  if (tol.zone?.unequalDisplacement) tolerance += ` UZ ${signed(tol.zone.unequalDisplacement, decimals)}`
  for (const m of tol.modifiers ?? []) tolerance += ' ' + formatModifier(m)
  if (tol.zone?.projectedLength) tolerance += ` Ⓟ ${formatNumber(tol.zone.projectedLength, decimals)}`
  if (tol.maxTolerance) tolerance += ` / ${formatNumber(tol.maxTolerance, decimals)} MAX`
  const datums = (tol.datumSystem ?? []).map(
    c => c.datums.join('-') + (c.modifiers ?? []).map(m => ' ' + formatModifier(m)).join(''),
  )
  return { tolerance, datums }
}

const toleranceNames: Record<string, string> = {
  straightness: 'Straightness',
  flatness: 'Flatness',
  roundness: 'Roundness',
  cylindricity: 'Cylindricity',
  lineProfile: 'Line profile',
  surfaceProfile: 'Surface profile',
  parallelism: 'Parallelism',
  perpendicularity: 'Perpendicularity',
  angularity: 'Angularity',
  position: 'Position',
  coaxiality: 'Coaxiality',
  concentricity: 'Concentricity',
  symmetry: 'Symmetry',
  circularRunout: 'Circular runout',
  totalRunout: 'Total runout',
}

export const toleranceName = (type: string) => toleranceNames[type] ?? type

const dimensionNames: Record<string, string> = {
  diameter: 'Diameter',
  radius: 'Radius',
  sphericalDiameter: 'Spherical diameter',
  sphericalRadius: 'Spherical radius',
  thickness: 'Thickness',
  curveLength: 'Curve length',
  angularSize: 'Angular size',
  linearDistance: 'Distance',
  curvedDistance: 'Curved distance',
  angular: 'Angle',
}

export const dimensionName = (type: string) => dimensionNames[type] ?? type

/** All annotated items of a document in table order: datums, dimensions, tolerances. */
export const entriesOf = (doc: PmiDocument | undefined): PmiEntry[] => {
  if (!doc) return []
  return [
    ...(doc.datums ?? []).map(item => ({ kind: 'datum' as const, item })),
    ...(doc.dimensions ?? []).map(item => ({ kind: 'dimension' as const, item })),
    ...(doc.tolerances ?? []).map(item => ({ kind: 'tolerance' as const, item })),
  ]
}

/** The features an entry is attached to (directly; derived features are resolved to their parents for highlighting). */
export const featuresOf = (doc: PmiDocument, entry: PmiEntry): PmiFeature[] => {
  const byId = new Map(doc.features.map(f => [f.id, f]))
  const ids: number[] =
    entry.kind === 'datum'
      ? [entry.item.feature]
      : entry.kind === 'dimension'
      ? entry.item.features
      : entry.item.feature !== undefined
      ? [entry.item.feature]
      : []
  const out: PmiFeature[] = []
  const visit = (id: number, depth: number) => {
    const f = byId.get(id)
    if (!f || depth > 8) return
    if (f.elements.length === 0 && f.parents.length > 0) f.parents.forEach(p => visit(p, depth + 1))
    else out.push(f)
  }
  ids.forEach(id => visit(id, 0))
  return out
}

/** The text in the "feature" column of the table. */
export const featureLabel = (doc: PmiDocument, entry: PmiEntry): string => {
  const byId = new Map(doc.features.map(f => [f.id, f]))
  const ids =
    entry.kind === 'datum'
      ? [entry.item.feature]
      : entry.kind === 'dimension'
      ? entry.item.features
      : entry.item.feature !== undefined
      ? [entry.item.feature]
      : []
  if (ids.length === 0) return 'whole part'
  return ids.map(id => byId.get(id)?.name ?? `#${id}`).join(', ')
}

export const statusColor = (status: PmiStatus, text: string): string => {
  switch (status) {
    case 'check':
      return '#fa8c16'
    case 'unresolved':
      return '#f5222d'
    case 'imported':
      return '#1677ff'
    default:
      return text
  }
}

export const statusLabel = (status: PmiStatus): string => {
  switch (status) {
    case 'valid':
      return 'valid'
    case 'check':
      return 'check'
    case 'unresolved':
      return 'missing geometry'
    case 'imported':
      return 'from file'
    default:
      return status
  }
}
