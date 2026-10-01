import { createApi, BuerliCadFacade } from '@buerli.io/classcad'
import { AppStyle, Icon, IconName, Readfile, ThemeToggle } from '@buerli.io/react-cad'
import React from 'react'
import styled from 'styled-components'

import { SimpleMessage } from './SimpleMessage'

type Start = { key: string; icon: IconName; name: string; note: string; run: () => void }

/**
 * What the app opens with while it holds no drawing: a sheet of squared-off paper, and on it the
 * three ways a drawing starts.
 */
export const WelcomePage: React.FC = () => {
  const rfRef = React.useRef<HTMLInputElement>()

  const createPart = React.useCallback(async () => {
    const newDrawingId = await BuerliCadFacade.utils.connect()
    newDrawingId && (await createApi(newDrawingId).v1.part.create({ name: 'Part' }).catch(console.info))
  }, [])

  const createAssembly = React.useCallback(async () => {
    const newDrawingId = await BuerliCadFacade.utils.connect()
    newDrawingId && (await createApi(newDrawingId).v1.assembly.create({ name: 'Assembly' }).catch(console.info))
  }, [])

  const openFile = React.useCallback(() => {
    rfRef.current && rfRef.current.click()
  }, [])

  const starts: Start[] = [
    { key: 'part', icon: 'part', name: 'New part', note: 'part.create', run: createPart },
    { key: 'assembly', icon: 'assembly', name: 'New assembly', note: 'assembly.create', run: createAssembly },
    { key: 'open', icon: 'open', name: 'Open a file', note: '.ofb  .stp  .step  .iwp', run: openFile },
  ]

  return (
    <Sheet className="rcad" data-rcad-root>
      <AppStyle />
      {(['tl', 'tr', 'bl', 'br'] as const).map(at => (
        <i key={at} className="rcad-corner" data-at={at} aria-hidden="true" />
      ))}
      <Head>
        <span>
          Buerligons <i>·</i> <em>CAD in the browser</em>
        </span>
        <ThemeToggle />
      </Head>
      <Card>
        <Kicker>New drawing</Kicker>
        <Title>Start with a part, an assembly, or a file.</Title>
        <Starts>
          {starts.map(start => (
            <li key={start.key}>
              <button type="button" onClick={start.run}>
                <span className="tile">
                  <Icon name={start.icon} size={20} />
                </span>
                <span className="name">{start.name}</span>
                <code>{start.note}</code>
                <Icon name="chevronRight" size={12} className="go" />
              </button>
            </li>
          ))}
        </Starts>
        <MessageSpace>
          <SimpleMessage />
        </MessageSpace>
      </Card>
      <Readfile ref={rfRef} singleDrawingApp />
    </Sheet>
  )
}

// The paper: the stage's ground, dotted every 28px, as the family's paper is.
const Sheet = styled.div`
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  padding: 72px 24px 48px;
  overflow: auto;
  background:
    radial-gradient(circle, var(--rcad-line-2) 1px, transparent 1.4px) 0 0 / 28px 28px,
    var(--rcad-viewport);
`

const Head = styled.header`
  position: absolute;
  top: 14px;
  right: 16px;
  left: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--rcad-ink);
  font: 500 10.5px/1 var(--rcad-font-mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;

  i,
  em {
    font-style: normal;
    opacity: 0.5;
  }
`

const Card = styled.main`
  width: min(440px, 100%);
  padding: 22px 22px 14px;
  border-radius: var(--rcad-r-window);
  background: var(--rcad-panel);
  box-shadow: var(--rcad-shadow-lg), var(--rcad-ring);
`

const Kicker = styled.div`
  color: var(--rcad-accent);
  font: 500 10.5px/1 var(--rcad-font-mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
`

const Title = styled.h1`
  margin: 10px 0 18px;
  color: var(--rcad-ink);
  font: 600 16px/1.35 var(--rcad-font-mono);
  letter-spacing: -0.01em;
  text-wrap: balance;
`

const Starts = styled.ul`
  margin: 0 -8px;
  padding: 0;
  list-style: none;

  li + li {
    border-top: 1px solid var(--rcad-chrome-line);
  }
  button {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto 12px;
    align-items: center;
    column-gap: 12px;
    width: 100%;
    margin: 4px 0;
    padding: 8px;
    border: 0;
    border-radius: var(--rcad-r-menu);
    background: none;
    color: var(--rcad-ink-2);
    text-align: left;
    cursor: pointer;
    transition:
      background-color 0.15s,
      color 0.15s;
  }
  button:hover,
  button:focus-visible {
    background: var(--rcad-hover);
    color: var(--rcad-ink);
  }
  button:focus-visible {
    outline: 2px solid var(--rcad-accent-line);
    outline-offset: 1px;
  }
  .tile {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    border-radius: var(--rcad-r-ctl);
    background: var(--rcad-panel-2);
    color: var(--rcad-ink);
  }
  .name {
    font: 600 13px/1.2 var(--rcad-font-mono);
  }
  code {
    padding: 0;
    border: 0;
    background: none;
    color: var(--rcad-dim);
    font: 500 10.5px/1 var(--rcad-font-mono);
    white-space: pre;
  }
  .go {
    color: var(--rcad-dim);
    transition: transform 0.2s var(--rcad-snap);
  }
  button:hover .go {
    color: var(--rcad-accent);
    transform: translateX(2px);
  }
`

const MessageSpace = styled.div`
  .buerli-simple-message {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--rcad-chrome-line);
    font: 500 11.5px/1.5 var(--rcad-font-mono);
    word-break: break-word;
  }
`
