import React from 'react'
import Icon from '@ant-design/icons'

export const MenuItemIcon: React.FC<{ url: string }> = ({ url }) => {
  return (
    <Icon component={() =>
      <span role="img" className="anticon anticon-eye-invisible ant-dropdown-menu-item-icon">
        <svg width={12} height={12}>
          <image href={url} width={12} height={12} />
        </svg>
      </span>
    } />
  )
}
