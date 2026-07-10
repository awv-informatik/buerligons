import { EyeOutlined } from '@ant-design/icons'
import React from 'react'
import { clearFollow, useFollow } from '../session/viewpoints'

/**
 * Notification shown while follow mode is active ("you are looking through
 * <peer>'s camera"). The X returns to the local view — FollowCamera restores
 * the pose that was saved when follow mode was entered.
 */
export const FollowBanner: React.FC = () => {
  const follow = useFollow()
  if (!follow) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px 8px 16px',
        borderRadius: 999,
        background: 'rgba(0,0,0,0.78)',
        color: '#fff',
        font: '13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        userSelect: 'none',
      }}
    >
      <EyeOutlined />
      <span>
        Viewing as <strong>{follow.name}</strong>
      </span>
      <button
        title="Back to your own view"
        onClick={clearFollow}
        style={{
          border: 'none',
          borderRadius: '50%',
          width: 22,
          height: 22,
          lineHeight: 1,
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        ✕
      </button>
    </div>
  )
}
