import { SessionPeer, SessionRole } from '@buerli.io/classcad'
import React from 'react'
import { buildInviteUrl, getInviteFromUrl, useSessionClient } from '../session/sessionClient'

// A token the host has created this session. The server does not keep a list
// the host can query, so we track what we minted here; presence events tell us
// which tokens currently have guests connected.
type Token = { token: string; name: string; role: SessionRole }

const ACCENT = '#e36b7c'
const GREEN = '#52c41a'
const GRAY = '#bfbfbf'

const dot = (active: boolean): React.CSSProperties => ({
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: active ? GREEN : GRAY,
  boxShadow: active ? `0 0 5px ${GREEN}` : 'none',
  flex: '0 0 auto',
})

/**
 * Session-sharing panel for buerligons.
 *
 * Renders only for the **host** — i.e. when connected via the multi-client
 * WSClient and the page was opened WITHOUT an ?invite= token. Lets the host
 * create optionally-named invite tokens, see which ones currently have guests
 * (green vs. gray dot), copy their share links, and revoke them (the X).
 * Guests and the WASM / SocketIO clients render nothing.
 */
export const SessionSharePanel: React.FC = () => {
  const client = useSessionClient()
  const isGuest = Boolean(getInviteFromUrl())

  const [tokens, setTokens] = React.useState<Token[]>([])
  const [peers, setPeers] = React.useState<SessionPeer[]>([])
  const [name, setName] = React.useState('')
  const [role, setRole] = React.useState<SessionRole>('edit')
  const [busy, setBusy] = React.useState(false)
  const [open, setOpen] = React.useState(true)
  const [copied, setCopied] = React.useState<string | null>(null)
  const [pos, setPos] = React.useState(() => ({ x: Math.max(12, window.innerWidth - PANEL_WIDTH - 12), y: 12 }))
  const dragRef = React.useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null)

  React.useEffect(() => {
    if (!client) return
    const update = () => setPeers(client.peers)
    update()
    client.on('peers_changed', update)
    return () => {
      client.removeListener('peers_changed', update)
    }
  }, [client])

  // Drag the panel by its header. A press that doesn't move is treated as a
  // click and toggles collapse, so the header keeps both behaviors.
  const onHeaderPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y, moved: false }
      const onMove = (ev: PointerEvent) => {
        const s = dragRef.current
        if (!s) return
        const dx = ev.clientX - s.startX
        const dy = ev.clientY - s.startY
        if (!s.moved && Math.abs(dx) + Math.abs(dy) > 3) s.moved = true
        setPos({
          x: Math.min(Math.max(0, s.baseX + dx), window.innerWidth - 40),
          y: Math.min(Math.max(0, s.baseY + dy), window.innerHeight - 40),
        })
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        const moved = dragRef.current?.moved
        dragRef.current = null
        if (!moved) setOpen(o => !o)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [pos.x, pos.y],
  )

  if (!client || isGuest) return null

  const guestsFor = (token: string) => peers.filter(p => p.invite === token).length
  const totalGuests = peers.length

  const create = async () => {
    setBusy(true)
    try {
      const inv = await client.createInvite(role, name.trim())
      setTokens(t => [...t, { token: inv.invite, name: inv.name, role: inv.role }])
      setName('')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[buerligons] createInvite failed', e)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (token: string) => {
    setBusy(true)
    try {
      await client.revokeInvite(token)
      setTokens(t => t.filter(x => x.token !== token))
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[buerligons] revokeInvite failed', e)
    } finally {
      setBusy(false)
    }
  }

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(token))
      setCopied(token)
      window.setTimeout(() => setCopied(c => (c === token ? null : c)), 1200)
    } catch {
      /* clipboard may be unavailable (non-secure context) — ignore */
    }
  }

  return (
    <div style={{ ...panelStyle, left: pos.x, top: pos.y, right: 'auto' }}>
      <div style={headerStyle} onPointerDown={onHeaderPointerDown}>
        <span style={dot(totalGuests > 0)} />
        <span style={{ fontWeight: 600, flex: 1 }}>Share session</span>
        <span style={{ color: '#888', fontSize: 12 }}>
          {totalGuests} {totalGuests === 1 ? 'guest' : 'guests'}
        </span>
        <span style={{ color: '#888', marginLeft: 8 }}>{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <div style={bodyStyle}>
          {tokens.length === 0 && (
            <div style={{ color: '#999', fontSize: 12, padding: '4px 0 8px' }}>
              No invites yet. Create one below and share its link.
            </div>
          )}

          {tokens.map(t => {
            const guests = guestsFor(t.token)
            return (
              <div key={t.token} style={rowStyle}>
                <span style={dot(guests > 0)} title={guests > 0 ? `${guests} connected` : 'nobody connected'} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 500 }}>{t.name || 'unnamed'}</span>
                  <span style={roleTag}>{t.role}</span>
                  {guests > 0 && <span style={{ color: GREEN, fontSize: 11, marginLeft: 6 }}>{guests} online</span>}
                </span>
                <button style={linkBtn} title="Copy invite link" disabled={busy} onClick={() => copy(t.token)}>
                  {copied === t.token ? 'copied' : 'link'}
                </button>
                <button style={revokeBtn} title="Revoke this invite" disabled={busy} onClick={() => revoke(t.token)}>
                  ✕
                </button>
              </div>
            )
          })}

          <div style={formStyle}>
            <input
              style={inputStyle}
              placeholder="name (optional)"
              value={name}
              maxLength={40}
              disabled={busy}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
            />
            <select
              style={selectStyle}
              value={role}
              disabled={busy}
              onChange={e => setRole(e.target.value as SessionRole)}
            >
              <option value="edit">edit</option>
              <option value="view">view</option>
            </select>
            <button style={createBtn} disabled={busy} onClick={create}>
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const PANEL_WIDTH = 300

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  width: PANEL_WIDTH,
  background: '#fff',
  border: '1px solid #eee',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  font: '13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#333',
  zIndex: 1000,
  userSelect: 'none',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  cursor: 'move',
  touchAction: 'none',
  borderBottom: '1px solid #f2f2f2',
}

const bodyStyle: React.CSSProperties = { padding: '8px 12px 12px' }

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 0',
  borderBottom: '1px solid #f7f7f7',
}

const roleTag: React.CSSProperties = {
  marginLeft: 8,
  padding: '0 6px',
  fontSize: 11,
  color: '#666',
  background: '#f2f2f2',
  borderRadius: 4,
}

const linkBtn: React.CSSProperties = {
  border: '1px solid #e0e0e0',
  background: '#fafafa',
  color: '#666',
  borderRadius: 4,
  fontSize: 11,
  padding: '2px 6px',
  cursor: 'pointer',
}

const revokeBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#c0392b',
  fontSize: 14,
  lineHeight: 1,
  padding: '2px 4px',
  cursor: 'pointer',
}

const formStyle: React.CSSProperties = { display: 'flex', gap: 6, marginTop: 10 }

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: '4px 6px',
  font: 'inherit',
}

const selectStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: '4px',
  font: 'inherit',
  background: '#fff',
}

const createBtn: React.CSSProperties = {
  border: 'none',
  background: ACCENT,
  color: '#fff',
  borderRadius: 4,
  padding: '4px 12px',
  cursor: 'pointer',
  fontWeight: 600,
}
