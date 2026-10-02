import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { sessionClient } from '@buerli.io/react-cad'
import React from 'react'
import styled from 'styled-components'

/**
 * Blocking overlay shown to a GUEST when their shared session ends — the host
 * revoked their invite, the host disconnected, or the connection dropped.
 *
 * Needed because a guest joins via ?invite= and cannot re-establish the session
 * on its own (the token may be revoked / the session gone). When the server
 * force-closes the socket, the WSClient sets both `active` and `connected` to
 * false, which suppresses the normal <Disconnected> overlay (it only fires
 * while still "active"). Without this, a kicked guest would silently freeze on
 * a stale model. This gives them a clear, interaction-blocking end state.
 *
 * It looks as <Disconnected> does: a scrim over the whole app, and one card that says so.
 */
export const GuestSessionOverlay: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const isGuest = Boolean(sessionClient.getInviteFromUrl())
  const connected = useDrawing(drawingId, d => d.cad.connection.connected)
  const wasConnectedRef = React.useRef(false)
  const [ended, setEnded] = React.useState(false)

  React.useEffect(() => {
    if (connected) {
      wasConnectedRef.current = true
    } else if (wasConnectedRef.current) {
      // Was connected, now isn't → the shared session is over for this guest.
      setEnded(true)
    }
  }, [connected])

  if (!isGuest || !ended) return null

  return (
    <Scrim className="rcad" role="alert" aria-live="assertive">
      <Card>
        <Kicker>Session ended</Kicker>
        <p>The host ended the shared session, or your access was revoked.</p>
        <button
          type="button"
          onClick={() => {
            // Drop the invite from the URL and reload into a clean welcome screen.
            window.location.href = `${window.location.origin}${window.location.pathname}`
          }}>
          Leave
        </button>
      </Card>
    </Scrim>
  )
}

const Scrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 100001;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--rcad-viewport) 72%, transparent);
  backdrop-filter: blur(2px);
`

const Card = styled.div`
  width: min(360px, 100%);
  padding: 16px 18px 18px;
  border-radius: var(--rcad-r-window);
  background: var(--rcad-toast-bg);
  box-shadow: var(--rcad-shadow-lg);
  color: var(--rcad-toast-text);

  p {
    margin: 10px 0 14px;
    font: 500 12px/1.55 var(--rcad-font-mono);
  }
  button {
    height: var(--rcad-ctl-h);
    padding: 0 14px;
    border: 1px solid color-mix(in srgb, var(--rcad-toast-strong) 32%, transparent);
    border-radius: var(--rcad-r-ctl);
    background: transparent;
    color: var(--rcad-toast-strong);
    font: 600 10.5px/1 var(--rcad-font-mono);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
  }
  button:hover {
    background: color-mix(in srgb, var(--rcad-toast-strong) 12%, transparent);
  }
  button:focus-visible {
    outline: 2px solid var(--rcad-accent-line);
    outline-offset: 2px;
  }
`

const Kicker = styled.div`
  color: var(--rcad-toast-strong);
  font: 600 10.5px/1 var(--rcad-font-mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
`
