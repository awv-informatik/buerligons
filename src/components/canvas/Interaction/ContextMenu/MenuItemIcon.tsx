import React from 'react'
import { Icon } from '@buerli.io/react-cad'

/** The drawing beside a menu's row. */
export const MenuItemIcon: React.FC<{ url: string }> = ({ url }) => (
  <span className="ant-dropdown-menu-item-icon" style={{ display: 'inline-flex' }}>
    <Icon url={url} size={16} />
  </span>
)
