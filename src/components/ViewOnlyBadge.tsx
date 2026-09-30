import { EyeOutlined } from '@ant-design/icons'
import React from 'react'

/**
 * Small fixed pill shown to a view-only guest, so it's always clear why the
 * editing controls are gone. Rendered only when read-only (the caller gates it).
 */
export const ViewOnlyBadge: React.FC = () => (
  <div
    style={{
      position: 'fixed',
      top: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 12px',
      borderRadius: 999,
      background: 'rgba(0,0,0,0.72)',
      color: '#fff',
      font: '12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      pointerEvents: 'none',
      userSelect: 'none',
    }}
  >
    <EyeOutlined />
    <span>View only</span>
  </div>
)
