import React from 'react'

export const MenuHeaderIcon: React.FC<{ url: string }> = ({ url }) => {
  return (
    <svg width={14} height={14}>
      <image href={url} width={14} height={14} />
    </svg>
  )
}