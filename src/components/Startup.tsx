import { BuerliCadFacade } from '@buerli.io/classcad'
import { useBuerli } from '@buerli.io/react'
import { useRCadThemeMode, sessionClient } from '@buerli.io/react-cad'
import React from 'react'
import { Buerligons } from './Buerligons'
import { WelcomePage } from './WelcomePage'

const startupBg = { light: '#fff', dark: '#1a1a1a' }

export const Startup: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.active || '')
  const isGuest = Boolean(sessionClient.getInviteFromUrl())
  const joinedRef = React.useRef(false)

  const mode = useRCadThemeMode()
  React.useEffect(() => void (document.title = 'buerligons'), [])

  // Guests (opened with ?invite=) skip the welcome screen entirely: connect
  // straight into the shared session. connect() joins via the invite token and
  // pulls the host's existing model through fetchTree — no "new part" command,
  // so there's no failing round-trip. The ref guards against a double connect.
  React.useEffect(() => {
    if (isGuest && count === 0 && !joinedRef.current) {
      joinedRef.current = true
      BuerliCadFacade.utils.connect().catch(e => {
        // eslint-disable-next-line no-console
        console.error('[buerligons] failed to join shared session', e)
        joinedRef.current = false
      })
    }
  }, [isGuest, count])

  const ready = count > 0 && drawingId
  if (ready) {
    return (
      <div style={{ backgroundColor: '#fff', height: '100%', width: '100%' }}>
        <Buerligons />
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: startupBg[mode], height: '100%', width: '100%' }}>
      {isGuest ? <JoiningScreen /> : <WelcomePage />}
    </div>
  )
}

const JoiningScreen: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      color: '#565656',
      font: '16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}
  >
    <div style={{ fontWeight: 800, fontSize: 32, marginBottom: 12 }}>buerligons</div>
    <div>Joining shared session…</div>
  </div>
)
