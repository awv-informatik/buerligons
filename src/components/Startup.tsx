import { BuerliCadFacade } from '@buerli.io/classcad'
import { useBuerli } from '@buerli.io/react'
import { AppStyle, sessionClient } from '@buerli.io/react-cad'
import React from 'react'
import styled from 'styled-components'
import { Buerligons } from './Buerligons'
import { WelcomePage } from './WelcomePage'
import { servedByEngine } from '../engine'

export const Startup: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.active || '')
  const isGuest = Boolean(sessionClient.getInviteFromUrl())
  const joinedRef = React.useRef(false)
  const [refused, setRefused] = React.useState(false)

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
        // No session behind the invite (it is over, or the invite was taken back): say so, and stop trying.
        setRefused(true)
      })
    }
  }, [isGuest, count])

  const ready = count > 0 && drawingId
  return (
    <div style={{ height: '100%', width: '100%' }}>
      {ready ? <Buerligons /> : isGuest ? <JoiningScreen refused={refused} /> : <WelcomePage />}
    </div>
  )
}

/**
 * What a guest sees until the shared session is there: the app's name, and that it is joining — or
 * that there is nothing to join, and what to do about it.
 */
const JoiningScreen: React.FC<{ refused: boolean }> = ({ refused }) => (
  <Joining role={refused ? 'alert' : 'status'} data-refused={refused || undefined}>
    <AppStyle />
    <b>Buerligons</b>
    {refused ? (
      <>
        <span>This session cannot be joined</span>
        <p>
          It is over, or the invite was taken back.{' '}
          {servedByEngine ? 'Ask your agent for the link again.' : 'Ask its host for a new link.'}
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </>
    ) : (
      <span>
        <i aria-hidden="true" /> Joining the shared session
      </span>
    )}
  </Joining>
)

const Joining = styled.div`
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  width: 100%;
  height: 100%;
  background: var(--rcad-viewport);
  color: var(--rcad-mute);
  font: 500 12px/1.4 var(--rcad-font-mono);

  b {
    color: var(--rcad-ink);
    font-weight: 700;
    font-size: 22px;
    letter-spacing: -0.01em;
  }
  span {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  /* orange is for work under way */
  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--rcad-orange);
    animation: buerligons-joining 1.2s ease-in-out infinite alternate;
  }
  @keyframes buerligons-joining {
    to {
      opacity: 0.25;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    i {
      animation: none;
    }
  }
  p {
    max-width: 320px;
    margin: 0;
    text-align: center;
    font-size: 12px;
    line-height: 1.55;
  }
  button {
    height: var(--rcad-ctl-h);
    padding: 0 14px;
    border: 1px solid var(--rcad-line);
    border-radius: var(--rcad-r-ctl);
    background: transparent;
    color: var(--rcad-ink);
    font: 600 10.5px/1 var(--rcad-font-mono);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
  }
  button:hover {
    background: color-mix(in srgb, var(--rcad-ink) 8%, transparent);
  }
  button:focus-visible {
    outline: 2px solid var(--rcad-accent-line);
    outline-offset: 2px;
  }
`
