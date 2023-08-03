import React from 'react'

export const MenuHeaderIcon: React.FC<{ url: string; size?: number }> = ({ url, size = 20 }) => {
  return (
    <svg width={size} height={size}>
      <image href={url} width={size} height={size} />
    </svg>
  )
}