import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { sessionClient } from '@buerli.io/react-cad'
import React from 'react'

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
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100001,
        display: 'grid',
        alignContent: 'center',
        justifyItems: 'center',
        gap: 8,
        background: 'rgba(0,0,0,0.72)',
        color: '#fff',
        textAlign: 'center',
        font: '16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 700 }}>Session ended</div>
      <div style={{ opacity: 0.85 }}>The host ended the shared session or your access was revoked.</div>
      <button
        style={{
          marginTop: 12,
          border: '1px solid rgba(255,255,255,0.5)',
          background: 'transparent',
          color: '#fff',
          borderRadius: 6,
          padding: '6px 16px',
          cursor: 'pointer',
          font: 'inherit',
        }}
        onClick={() => {
          // Drop the invite from the URL and reload into a clean welcome screen.
          window.location.href = `${window.location.origin}${window.location.pathname}`
        }}
      >
        Leave
      </button>
    </div>
  )
}
