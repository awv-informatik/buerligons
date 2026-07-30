import { DrawingID } from '@buerli.io/core'
import { Html } from '@react-three/drei'
import React from 'react'

import {
  addAnnotationEntry,
  Annotation,
  annotationWorldMatrix,
  AnnotationDraft,
  AnnotationEntry,
  authorColor,
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
// renders as a small badge at its (parent-relative) position, tinted with the
// creator's identity color (derived from the author name, so it is stable
// across clients and sessions). Hovering the badge unfolds an animated,
// height-capped preview of the thread; clicking opens the full panel where
// entries can be added or removed. Each comment row carries the color of its
// issuer. A draft marker (from right-click -> Add comment) shows the same
// editor before the ClassCAD object exists.

const ACCENT = '#e36b7c'
const PREVIEW_MAX_HEIGHT = 140

const badgeStyle = (color: string, active: boolean): React.CSSProperties => ({
  pointerEvents: 'auto',
  cursor: 'pointer',
  minWidth: 22,
  height: 22,
  padding: '0 6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  background: color,
  color: '#fff',
  border: '1.5px solid rgba(255,255,255,0.85)',
  borderRadius: '11px 11px 11px 2px',
  boxShadow: active ? `0 0 0 2px ${color}55, 0 2px 6px rgba(0,0,0,0.3)` : '0 2px 6px rgba(0,0,0,0.25)',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'system-ui, sans-serif',
  userSelect: 'none',
  whiteSpace: 'nowrap',
})

const panelStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  position: 'absolute',
  left: 14,
  top: 14,
  width: 240,
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid #ddd',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  color: '#333',
  overflow: 'hidden',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
}

const buttonStyle: React.CSSProperties = {
  border: 'none',
  background: ACCENT,
  color: '#fff',
  borderRadius: 4,
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

const iconButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#999',
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

/** One comment line: left border + author name in the issuer's color. */
const EntryRow: React.FC<{
  entry: AnnotationEntry
  onRemove?: () => void
  clampComment?: boolean
}> = ({ entry, onRemove, clampComment }) => {
  const color = authorColor(entry.author)
  return (
    <div style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, color }}>{entry.author || 'unnamed'}</span>
        <span style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
          <span style={{ color: '#999', fontSize: 10 }}>{timeLabel(entry.created)}</span>
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
  onAuthor: (v: string) => void
  onSubmit: (comment: string) => void
  onCancel?: () => void
  autoFocus?: boolean
}> = ({ author, onAuthor, onSubmit, onCancel, autoFocus }) => {
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
          <button style={{ ...buttonStyle, background: '#bbb' }} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button style={{ ...buttonStyle, opacity: comment.trim() ? 1 : 0.5 }} onClick={submit}>
          Comment
        </button>
      </div>
    </div>
  )
}

/** Prefill order: last used name (localStorage) → invite token name →
 *  'host' when sharing a session → empty. Always editable; edits stick. */
const useDefaultAuthor = (): [string, (v: string) => void] => {
  const client = sessionClient.useSessionClient()
  const [author, setAuthor] = React.useState(() => getStoredAuthor() || client?.inviteName || (client ? 'host' : ''))
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

  // Chip color = original creator (first entry's author).
  const creatorColor = authorColor(annotation.entries[0]?.author ?? '')

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
          <div style={badgeStyle(creatorColor, open)} onClick={onToggle} title={open ? undefined : 'Open comments'}>
            💬 {annotation.entries.length}
          </div>

          {/* Hover preview: unfolds to a capped height; "…" hints at cut-off
              content. Click anywhere on it to open the full thread. */}
          {!open && (
            <div
              style={{
                ...panelStyle,
                pointerEvents: showPreview ? 'auto' : 'none',
                cursor: 'pointer',
                maxHeight: showPreview ? PREVIEW_MAX_HEIGHT + (clipped ? 16 : 0) : 0,
                opacity: showPreview ? 1 : 0,
                border: showPreview ? panelStyle.border : 'none',
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
                <div
                  style={{
                    textAlign: 'center',
                    fontWeight: 700,
                    color: '#999',
                    lineHeight: '16px',
                    height: 16,
                    background: 'linear-gradient(rgba(255,255,255,0), rgba(255,255,255,1) 60%)',
                  }}
                >
                  …
                </div>
              )}
            </div>
          )}

          {open && (
            <div style={panelStyle} onPointerDown={e => e.stopPropagation()}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderBottom: '1px solid #eee',
                  borderTop: `3px solid ${creatorColor}`,
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

  const submit = (text: string) => {
    createAnnotation(drawingId, draft.targetId, draft.position, author.trim(), text)
      .finally(clearAnnotationDraft)
      .catch(console.warn)
  }

  return (
    <group position={worldPos}>
      <Html style={{ pointerEvents: 'none' }} zIndexRange={[80, 0]}>
        <div style={{ position: 'relative' }}>
          <div style={badgeStyle(authorColor(author), true)}>💬</div>
          <div style={panelStyle} onPointerDown={e => e.stopPropagation()}>
            <div
              style={{
                padding: '6px 8px',
                borderBottom: '1px solid #eee',
                borderTop: `3px solid ${authorColor(author)}`,
                fontWeight: 600,
              }}
            >
              New comment
            </div>
            <EntryForm author={author} onAuthor={setAuthor} onSubmit={submit} onCancel={clearAnnotationDraft} autoFocus />
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
