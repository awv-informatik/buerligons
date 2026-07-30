import { DrawingID } from '@buerli.io/core'
import { Html } from '@react-three/drei'
import React from 'react'

import {
  addAnnotationEntry,
  Annotation,
  annotationWorldMatrix,
  AnnotationDraft,
  AnnotationEntry,
  authorColors,
  AuthorColors,
  clearAnnotationDraft,
  createAnnotation,
  deleteAnnotation,
  getStoredAuthor,
  rememberAuthor,
  removeAnnotationEntry,
  useAnnotationDraft,
  useAnnotations,
} from '../../annotations/annotations'
import { sessionClient } from '@buerli.io/react-cad'

// Comment markers pinned to the model. Every CC_Annotation node in the tree
// renders as a small badge at its (parent-relative) position, colored in the
// creator's identity pastel (derived from the author name, so it is stable
// across clients and sessions). Chip and thread use the pastel as SURFACE
// with the matching dark same-hue text — contrast is built into the pair, so
// the colored UI is independent of the app's light/dark theme. Hovering the
// badge unfolds an animated, height-capped preview; clicking opens the full
// panel. Each comment row carries the accent of its issuer. A draft marker
// (from right-click -> Add comment) shows the same editor before the
// ClassCAD object exists.

const PREVIEW_MAX_HEIGHT = 140

const badgeStyle = (colors: AuthorColors, active: boolean): React.CSSProperties => ({
  pointerEvents: 'auto',
  cursor: 'pointer',
  minWidth: 22,
  height: 22,
  padding: '0 6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  background: colors.bg,
  color: colors.text,
  border: `1.5px solid ${colors.accent}`,
  borderRadius: '11px 11px 11px 2px',
  boxShadow: active ? `0 0 0 2px ${colors.accent}55, 0 2px 6px rgba(0,0,0,0.3)` : '0 2px 6px rgba(0,0,0,0.25)',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'system-ui, sans-serif',
  userSelect: 'none',
  whiteSpace: 'nowrap',
})

const panelStyle = (colors: AuthorColors): React.CSSProperties => ({
  pointerEvents: 'auto',
  position: 'absolute',
  left: 14,
  top: 14,
  width: 240,
  background: colors.bg,
  border: `1px solid ${colors.accent}`,
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  color: colors.text,
  overflow: 'hidden',
})

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.65)',
  border: '1px solid rgba(0,0,0,0.15)',
  color: 'rgba(0,0,0,0.85)',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
}

const buttonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 4,
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

const iconButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  opacity: 0.55,
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
  padding: 2,
}

const timeLabel = (ms: number): string => {
  if (!ms) return ''
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ms).toLocaleDateString()
}

/** One comment block, fully surfaced in its ISSUER's pastel with the
 *  matching dark text — threads with multiple commenters read as stacked
 *  color blocks from the shared palette. */
const EntryRow: React.FC<{
  entry: AnnotationEntry
  onRemove?: () => void
  clampComment?: boolean
}> = ({ entry, onRemove, clampComment }) => {
  const issuer = authorColors(entry.author)
  return (
    <div style={{ padding: '6px 8px', background: issuer.bg, color: issuer.text, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600 }}>{entry.author || 'unnamed'}</span>
        <span style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
          <span style={{ opacity: 0.55, fontSize: 10 }}>{timeLabel(entry.created)}</span>
          {onRemove && (
            <button style={iconButtonStyle} title="Remove this comment" onClick={onRemove}>
              ✕
            </button>
          )}
        </span>
      </div>
      <div
        style={
          clampComment
            ? {
                marginTop: 2,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
              }
            : { whiteSpace: 'pre-wrap', marginTop: 2 }
        }
      >
        {entry.comment}
      </div>
    </div>
  )
}

/** Author + comment inputs shared by the thread editor and the draft form. */
const EntryForm: React.FC<{
  author: string
  colors: AuthorColors
  onAuthor: (v: string) => void
  onSubmit: (comment: string) => void
  onCancel?: () => void
  autoFocus?: boolean
}> = ({ author, colors, onAuthor, onSubmit, onCancel, autoFocus }) => {
  const [comment, setComment] = React.useState('')
  const submit = () => {
    const text = comment.trim()
    if (!text) return
    onSubmit(text)
    setComment('')
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
      <input
        style={inputStyle}
        placeholder="Your name"
        value={author}
        onChange={e => onAuthor(e.target.value)}
      />
      <textarea
        style={{ ...inputStyle, resize: 'none', height: 48 }}
        placeholder="Write a comment…"
        value={comment}
        autoFocus={autoFocus}
        onChange={e => setComment(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape' && onCancel) onCancel()
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        {onCancel && (
          <button
            style={{
              ...buttonStyle,
              background: 'transparent',
              border: `1px solid ${colors.accent}`,
              color: 'inherit',
            }}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          style={{
            ...buttonStyle,
            background: colors.text,
            color: colors.bg,
            opacity: comment.trim() ? 1 : 0.5,
          }}
          onClick={submit}
        >
          Comment
        </button>
      </div>
    </div>
  )
}

/** Prefill matches the name-tag convention: 'buerligons.username' override →
 *  invite token name (guests) → 'Host'. Editable; an edit becomes the
 *  username override, so name AND color stay consistent everywhere. */
const useDefaultAuthor = (): [string, (v: string) => void] => {
  const client = sessionClient.useSessionClient()
  const isGuest = Boolean(sessionClient.getInviteFromUrl())
  const tokenName = client?.inviteName || ''
  const [author, setAuthor] = React.useState(
    () => getStoredAuthor() || (isGuest ? tokenName || 'unnamed' : client ? 'Host' : ''),
  )
  // The token name arrives with SessionJoined, possibly after mount — adopt
  // it as long as the user has neither typed nor stored an own name.
  React.useEffect(() => {
    if (isGuest && tokenName && !getStoredAuthor()) {
      setAuthor(a => (!a || a === 'unnamed' ? tokenName : a))
    }
  }, [isGuest, tokenName])
  const update = (v: string) => {
    setAuthor(v)
    rememberAuthor(v)
  }
  return [author, update]
}

const AnnotationMarker: React.FC<{
  drawingId: DrawingID
  annotation: Annotation
  open: boolean
  onToggle: () => void
}> = ({ drawingId, annotation, open, onToggle }) => {
  const [author, setAuthor] = useDefaultAuthor()
  const [hovered, setHovered] = React.useState(false)
  const [clipped, setClipped] = React.useState(false)
  const previewInnerRef = React.useRef<HTMLDivElement>(null)

  // Chip + thread surface = original creator (first entry's author).
  const creator = authorColors(annotation.entries[0]?.author ?? '')

  const worldPos = React.useMemo(() => {
    const m = annotationWorldMatrix(drawingId, annotation.id)
    return [m.elements[12], m.elements[13], m.elements[14]] as [number, number, number]
  }, [drawingId, annotation])

  const showPreview = hovered && !open
  React.useEffect(() => {
    const el = previewInnerRef.current
    if (showPreview && el) setClipped(el.scrollHeight > PREVIEW_MAX_HEIGHT)
  }, [showPreview, annotation])

  return (
    <group position={worldPos}>
      <Html style={{ pointerEvents: 'none' }} zIndexRange={[80, 0]}>
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div style={badgeStyle(creator, open)} onClick={onToggle} title={open ? undefined : 'Open comments'}>
            💬 {annotation.entries.length}
          </div>

          {/* Hover preview: unfolds to a capped height; "…" hints at cut-off
              content. Click anywhere on it to open the full thread. */}
          {!open && (
            <div
              style={{
                ...panelStyle(creator),
                pointerEvents: showPreview ? 'auto' : 'none',
                cursor: 'pointer',
                maxHeight: showPreview ? PREVIEW_MAX_HEIGHT + (clipped ? 16 : 0) : 0,
                opacity: showPreview ? 1 : 0,
                border: showPreview ? `1px solid ${creator.accent}` : 'none',
                transition: 'max-height 0.2s ease, opacity 0.15s ease',
              }}
              onClick={onToggle}
              title="Click to open the thread"
            >
              <div ref={previewInnerRef} style={{ maxHeight: PREVIEW_MAX_HEIGHT, overflow: 'hidden' }}>
                {annotation.entries.map((entry, i) => (
                  <EntryRow key={`${entry.created}-${i}`} entry={entry} clampComment />
                ))}
              </div>
              {clipped && (
                <div style={{ textAlign: 'center', fontWeight: 700, opacity: 0.7, lineHeight: '16px', height: 16 }}>
                  …
                </div>
              )}
            </div>
          )}

          {open && (
            <div style={panelStyle(creator)} onPointerDown={e => e.stopPropagation()}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  borderTop: `3px solid ${creator.accent}`,
                  fontWeight: 600,
                }}
              >
                <span>Comments</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button
                    style={iconButtonStyle}
                    title="Delete this comment thread"
                    onClick={() => deleteAnnotation(drawingId, annotation.id).catch(console.warn)}
                  >
                    🗑
                  </button>
                  <button style={iconButtonStyle} title="Close" onClick={onToggle}>
                    ✕
                  </button>
                </span>
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {annotation.entries.map((entry, i) => (
                  <EntryRow
                    key={`${entry.created}-${i}`}
                    entry={entry}
                    onRemove={() => removeAnnotationEntry(drawingId, annotation.id, i).catch(console.warn)}
                  />
                ))}
              </div>
              <EntryForm
                author={author}
                colors={creator}
                onAuthor={setAuthor}
                onSubmit={text => addAnnotationEntry(drawingId, annotation.id, author.trim(), text).catch(console.warn)}
              />
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

const DraftMarker: React.FC<{ drawingId: DrawingID; draft: AnnotationDraft }> = ({ drawingId, draft }) => {
  const [author, setAuthor] = useDefaultAuthor()
  const worldPos = React.useMemo(() => {
    const m = annotationWorldMatrix(drawingId, draft.targetId)
    const [x, y, z] = draft.position
    const e = m.elements
    return [
      e[0] * x + e[4] * y + e[8] * z + e[12],
      e[1] * x + e[5] * y + e[9] * z + e[13],
      e[2] * x + e[6] * y + e[10] * z + e[14],
    ] as [number, number, number]
  }, [drawingId, draft])

  const colors = authorColors(author)

  const submit = (text: string) => {
    createAnnotation(drawingId, draft.targetId, draft.position, author.trim(), text)
      .finally(clearAnnotationDraft)
      .catch(console.warn)
  }

  return (
    <group position={worldPos}>
      <Html style={{ pointerEvents: 'none' }} zIndexRange={[80, 0]}>
        <div style={{ position: 'relative' }}>
          <div style={badgeStyle(colors, true)}>💬</div>
          <div style={panelStyle(colors)} onPointerDown={e => e.stopPropagation()}>
            <div
              style={{
                padding: '6px 8px',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                borderTop: `3px solid ${colors.accent}`,
                fontWeight: 600,
              }}
            >
              New comment
            </div>
            <EntryForm author={author} colors={colors} onAuthor={setAuthor} onSubmit={submit} onCancel={clearAnnotationDraft} autoFocus />
          </div>
        </div>
      </Html>
    </group>
  )
}

export const Annotations: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const annotations = useAnnotations(drawingId)
  const draft = useAnnotationDraft()
  const [openId, setOpenId] = React.useState<number | null>(null)

  return (
    <>
      {annotations.map(annotation => (
        <AnnotationMarker
          key={annotation.id}
          drawingId={drawingId}
          annotation={annotation}
          open={openId === annotation.id}
          onToggle={() => setOpenId(openId === annotation.id ? null : annotation.id)}
        />
      ))}
      {draft && <DraftMarker drawingId={drawingId} draft={draft} />}
    </>
  )
}
