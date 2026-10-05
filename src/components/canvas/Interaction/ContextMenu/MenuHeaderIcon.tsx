import React from 'react'
import { Icon } from '@buerli.io/react-cad'

/** The drawing of the thing a menu is on, in its head. */
export const MenuHeaderIcon: React.FC<{ url: string }> = ({ url }) => <Icon url={url} size={16} />
