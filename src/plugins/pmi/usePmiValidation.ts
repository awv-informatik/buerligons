import { getApiFacade } from '@buerli.io/classcad'
import { DrawingID } from '@buerli.io/core'
import React from 'react'
import { PmiDocument } from './types'

/** A finding of `api.v1.pmi.validate`. */
export type PmiIssue = {
  level: 'error' | 'warning' | string
  message: string
  /** syntax | semantics | model (the three levels of the validation) */
  category?: string
  /** the PMI item it is about */
  id?: number
  name?: string
}

export type PmiValidation = { errors: number; warnings: number; issues: PmiIssue[]; byItem: Record<number, PmiIssue[]> }

const empty: PmiValidation = { errors: 0, warnings: 0, issues: [], byItem: {} }

/**
 * The validation of the PMI of a part (`api.v1.pmi.validate`), run again whenever the document changes (it is
 * loaded again after every command and regeneration). Usable in any app that has a drawing.
 */
export const usePmiValidation = (drawingId: DrawingID, doc: PmiDocument | undefined): PmiValidation => {
  const [state, setState] = React.useState<PmiValidation>(empty)
  const request = React.useRef(0)
  React.useEffect(() => {
    if (!doc?.part) {
      setState(empty)
      return
    }
    const ticket = ++request.current
    getApiFacade(drawingId)
      .callSafeApiV('v1', 'pmi', 'validate', { id: doc.part })
      .then((res: any) => {
        if (ticket !== request.current) return
        const r = res?.result
        const issues: PmiIssue[] = r?.messages ?? []
        const byItem: Record<number, PmiIssue[]> = {}
        issues.forEach(i => {
          if (typeof i.id === 'number') (byItem[i.id] = byItem[i.id] ?? []).push(i)
        })
        setState({ errors: r?.errors ?? 0, warnings: r?.warnings ?? 0, issues, byItem })
      })
      .catch(() => ticket === request.current && setState(empty))
  }, [drawingId, doc])
  return state
}
