import { getApiFacade } from '@buerli.io/classcad'
import { DrawingID, ObjectID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import React from 'react'
import { PmiDocument } from './types'

export const PMI_SET_CLASS = 'CC_PmiSet'

/** The id of the current part's PMI set (child "PmiSet" of class CC_PmiSet), if it has one. */
export const usePmiSetId = (drawingId: DrawingID): ObjectID | undefined =>
  useDrawing(drawingId, d => {
    const prod = d.structure.currentProduct
    if (!prod) return undefined
    const tree = d.structure.tree
    return tree[prod]?.children?.find(ch => tree[ch]?.class === PMI_SET_CLASS)
  })

export type PmiDocumentState = { doc?: PmiDocument; error?: string; loading: boolean }

/**
 * The PMI document of the current part (or of `partId`), kept up to date: it is fetched with `api.v1.pmi.get`
 * (through the facade, the typed client API has no pmi namespace yet) whenever the PMI set changes or a
 * command was executed (cad state counter), so regenerations update statuses and positions; `revision` lets the
 * caller ask for a reload (after its own PMI commands).
 * Usable in any app that has a drawing: no plugin needed.
 */
export const usePmiDocument = (drawingId: DrawingID, partId?: ObjectID, revision = 0): PmiDocumentState => {
  const currentProduct = useDrawing(drawingId, d => d.structure.currentProduct)
  const part = partId ?? currentProduct
  const setId = usePmiSetId(drawingId)
  const setObject = useDrawing(drawingId, d => (setId ? d.structure.tree[setId] : undefined))
  const stateCounter = useDrawing(drawingId, d => d.cad.states?.current)
  const [state, setState] = React.useState<PmiDocumentState>({ loading: false })
  const request = React.useRef(0)

  React.useEffect(() => {
    if (!part || !setId) {
      setState({ loading: false })
      return
    }
    const ticket = ++request.current
    setState(s => ({ ...s, loading: true }))
    const timer = setTimeout(async () => {
      try {
        const res = await getApiFacade(drawingId).callSafeApiV('v1', 'pmi', 'get', { id: part })
        if (ticket === request.current) setState({ doc: res?.result as PmiDocument, loading: false })
      } catch (e: any) {
        if (ticket === request.current) setState({ error: String(e?.messages?.[0]?.message ?? e?.message ?? e), loading: false })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [drawingId, part, setId, setObject, stateCounter, revision])

  return state
}
