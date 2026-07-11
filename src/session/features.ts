/* eslint-disable @typescript-eslint/ban-ts-comment */
// Collaboration feature flags for shared sessions. Everything is OFF by
// default — features must be enabled explicitly. Resolution per flag, first
// source that speaks wins:
//
//   1. URL param            ?viewpoints=on|off  ?cursors=on|off
//   2. localStorage         'buerligons.features' = "viewpoints,cursors"
//   3. build-time define    SESSION_FEATURES="viewpoints,cursors"  (.env / script)
//   4. default              off
//
// Flags are resolved once at startup; changing localStorage or the define
// requires a reload (the URL param obviously implies one).

export type SessionFeatures = {
  /** Peer camera frustums, name tags, and follow mode (click a marker). */
  viewpoints: boolean
  /** Peer pointer while following. Only effective when viewpoints is on. */
  cursors: boolean
}

const FLAG_NAMES: (keyof SessionFeatures)[] = ['viewpoints', 'cursors']

// @ts-ignore — injected by vite (see vite.config.ts define)
const buildDefine: string = typeof SESSION_FEATURES !== 'undefined' ? SESSION_FEATURES : ''

const parseList = (value: string | null | undefined): Set<string> | null => {
  if (value == null) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  if (trimmed === 'off' || trimmed === 'none') return new Set()
  return new Set(
    trimmed
      .split(',')
      .map(x => x.trim())
      .filter(Boolean),
  )
}

const urlFlag = (name: string): boolean | null => {
  try {
    const v = new URLSearchParams(window.location.search).get(name)
    if (v == null) return null
    return !['off', '0', 'false', 'no'].includes(v.toLowerCase())
  } catch {
    return null
  }
}

const storedList = (): Set<string> | null => {
  try {
    return parseList(window.localStorage.getItem('buerligons.features'))
  } catch {
    return null
  }
}

const resolve = (): SessionFeatures => {
  const ls = storedList()
  const build = parseList(buildDefine)
  const flag = (name: keyof SessionFeatures): boolean => {
    const fromUrl = urlFlag(name)
    if (fromUrl != null) return fromUrl
    if (ls) return ls.has(name)
    if (build) return build.has(name)
    return false
  }
  const raw = Object.fromEntries(FLAG_NAMES.map(n => [n, flag(n)])) as SessionFeatures
  // Cursors only render in follow mode, which requires viewpoint markers to
  // enter — without viewpoints they would broadcast for nothing.
  return { ...raw, cursors: raw.cursors && raw.viewpoints }
}

/** Resolved once at startup. */
export const sessionFeatures: SessionFeatures = resolve()
