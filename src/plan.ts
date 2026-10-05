import { WASMClient } from '@buerli.io/classcad'
import { DrawingID, showMessage } from '@buerli.io/core'

// ClassCAD in the page needs an engine key. Buerligons carries none: it takes a public access
// token (ccpk_…, made on classcad.ch/account) and asks ClassCAD's backend for the key the
// account's plan allows for this page's origin. The key is kept until shortly before it expires;
// while the backend cannot be reached, a kept key that has not expired still starts the engine.
// CLASSCAD_WASM_KEY still takes a key of one's own.

export type EnginePlan = { key: string; exp: number; plan: string; exportFormats: string[] }

export const DEFAULT_KEY_URL = 'https://europe-west1-classcad-app.cloudfunctions.net/api/v1/key'

const KEPT = 'buerligons.engine-key'
const DAY = 24 * 3600 * 1000

const kept = (token: string): (EnginePlan & { iat: number; token: string }) | null => {
  try {
    const k = JSON.parse(localStorage.getItem(KEPT) || 'null')
    return k && k.token === token.slice(0, 12) ? k : null
  } catch {
    return null
  }
}

const request = async (token: string, keyUrl: string): Promise<EnginePlan> => {
  const res = await fetch(keyUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ appType: 'wasm', client: 'buerligons' }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.key) {
    const error = new Error(body?.message ?? `the ClassCAD key service answered ${res.status}`) as Error & { final?: boolean }
    error.final = res.status >= 400 && res.status < 500
    throw error
  }
  const plan = { key: body.key, exp: body.exp, plan: body.plan, exportFormats: body.exportFormats ?? [] }
  try {
    localStorage.setItem(KEPT, JSON.stringify({ ...plan, iat: Date.now(), token: token.slice(0, 12) }))
  } catch {
    // a full or blocked storage only costs a request next time
  }
  return plan
}

/** The engine key: a key of one's own, or one for the access token. */
export const engineKey = async (options: { key?: string; token?: string; keyUrl?: string }): Promise<EnginePlan> => {
  if (options.key) return { key: options.key, exp: Number.MAX_SAFE_INTEGER, plan: 'own key', exportFormats: ['*'] }
  if (!options.token) throw new Error('Set CLASSCAD_TOKEN in .env to a public access token from classcad.ch/account.')
  const keyUrl = options.keyUrl || DEFAULT_KEY_URL
  const k = kept(options.token)
  const now = Date.now()
  if (k && k.exp > now + 60 * 1000) {
    const left = k.exp - now
    // The engine checks its key at start only: renewing now readies the next start
    if (left < DAY || left < (k.exp - k.iat) * 0.25) request(options.token, keyUrl).catch(() => undefined)
    return k
  }
  try {
    return await request(options.token, keyUrl)
  } catch (error) {
    if (k && k.exp > now && !(error as { final?: boolean }).final) return k
    throw error
  }
}

// What the formats are called in the plans
const PLAN_FORMAT: Record<string, string> = { STP: 'step', STEP: 'step', STL: 'stl', GLB: 'stl', OFB: 'ofb', JSON: 'ofb' }

/** Why an engine task may not run on this plan: a save in a format the plan does not export. */
export const blockedSave = (task: unknown, exportFormats: string[]): string | null => {
  if (!exportFormats.length || exportFormats.includes('*')) return null
  const text = JSON.stringify(task ?? '')
  if (!/v1\.common\.save/.test(text)) return null
  const format = /"format"\s*:\s*"([A-Za-z]+)"/.exec(text)?.[1]?.toUpperCase()
  const wanted = format && PLAN_FORMAT[format]
  if (!wanted || exportFormats.includes(wanted)) return null
  return `Your plan saves ${exportFormats.map(f => f.toUpperCase()).join(' and ')}. ${format} comes with Solo and up: https://classcad.ch/subscriptions`
}

/** The page's engine, holding the plan's export formats. */
export class PlanClient extends WASMClient {
  constructor(drawingId: DrawingID, config: ConstructorParameters<typeof WASMClient>[1] & Record<string, unknown>, private plan: EnginePlan) {
    super(drawingId, config)
  }

  protected request(command: Parameters<WASMClient['requestByName']>[1] & { command?: string; task?: unknown }) {
    if (command && command.command === 'Execute') {
      const reason = blockedSave(command.task, this.plan.exportFormats)
      if (reason) {
        showMessage({ type: 'warning', text: reason })
        return Promise.reject(new Error(reason))
      }
    }
    return super.request(command as any)
  }
}
