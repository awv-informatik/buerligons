import React from 'react'

export const MenuHeaderIcon: React.FC<{ url: string }> = ({ url }) => {
  return (
    <span style={{ marginTop: '1px', marginRight: '7px', verticalAlign: '-1px' }}>
      <svg width="14" height="14">
        <image href={url} width="14" height="14" />
      </svg>
    </span>
  )
}
