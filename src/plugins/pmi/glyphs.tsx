import React from 'react'

// Geometric characteristic symbols of ISO 1101 / ASME Y14.5 as small SVGs (stroke = currentColor), so the
// frames look the same in every browser and do not depend on a font with GD&T glyphs.

type GlyphProps = { size?: number }

const Svg: React.FC<React.PropsWithChildren<GlyphProps>> = ({ size = 14, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.3}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block' }}>
    {children}
  </svg>
)

const glyphs: Record<string, React.ReactNode> = {
  straightness: <line x1="2" y1="8" x2="14" y2="8" />,
  flatness: <polygon points="5,4 15,4 11,12 1,12" />,
  roundness: <circle cx="8" cy="8" r="5.5" />,
  cylindricity: (
    <>
      <circle cx="8" cy="8" r="4.5" />
      <line x1="3" y1="14" x2="7" y2="2" />
      <line x1="9" y1="14" x2="13" y2="2" />
    </>
  ),
  lineProfile: <path d="M2 12 A6 6 0 0 1 14 12" />,
  surfaceProfile: <path d="M2 12 A6 6 0 0 1 14 12 Z" />,
  parallelism: (
    <>
      <line x1="3" y1="14" x2="8" y2="2" />
      <line x1="8" y1="14" x2="13" y2="2" />
    </>
  ),
  perpendicularity: (
    <>
      <line x1="8" y1="2" x2="8" y2="14" />
      <line x1="2" y1="14" x2="14" y2="14" />
    </>
  ),
  angularity: (
    <>
      <line x1="2" y1="14" x2="14" y2="14" />
      <line x1="2" y1="14" x2="13" y2="4" />
    </>
  ),
  position: (
    <>
      <circle cx="8" cy="8" r="4" />
      <line x1="8" y1="1" x2="8" y2="15" />
      <line x1="1" y1="8" x2="15" y2="8" />
    </>
  ),
  coaxiality: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.8" />
    </>
  ),
  concentricity: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.8" />
    </>
  ),
  symmetry: (
    <>
      <line x1="4" y1="4" x2="12" y2="4" />
      <line x1="1" y1="8" x2="15" y2="8" />
      <line x1="4" y1="12" x2="12" y2="12" />
    </>
  ),
  circularRunout: (
    <>
      <line x1="3" y1="14" x2="12" y2="3" />
      <polyline points="7,3 12,3 12,8" />
    </>
  ),
  totalRunout: (
    <>
      <line x1="2" y1="14" x2="9" y2="5" />
      <line x1="7" y1="14" x2="14" y2="5" />
      <line x1="1" y1="14" x2="9" y2="14" />
      <polyline points="5,5 9,5 9,9" />
      <polyline points="10,5 14,5 14,9" />
    </>
  ),
}

export const ToleranceGlyph: React.FC<GlyphProps & { type: string }> = ({ type, size }) => {
  const glyph = glyphs[type]
  if (!glyph) return <span style={{ fontSize: 10 }}>{type}</span>
  return <Svg size={size}>{glyph}</Svg>
}

/** The filled triangle of a datum feature symbol. */
export const DatumTriangle: React.FC<GlyphProps> = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" style={{ display: 'block' }}>
    <polygon points="5,1 9.5,9.5 0.5,9.5" fill="currentColor" />
  </svg>
)
