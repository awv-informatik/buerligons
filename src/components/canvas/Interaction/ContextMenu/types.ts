import { MenuDividerType, MenuItemGroupType, MenuItemType, SubMenuType } from 'antd/lib/menu/hooks/useItems'

import { InteractionInfo } from "@buerli.io/core";
import { CCClasses } from '@buerli.io/classcad';

export type MenuObjType = 'background' | 'point' | 'line' | 'mesh' | CCClasses

export type MenuInfo = { clickPos: THREE.Vector3; clickNormal?: THREE.Vector3; interactionInfo?: InteractionInfo }

// Omit<ItemType, 'onClick'> somehow messes up the whole type, so Omit its compound parts wiht onClick
export type MenuElement = (Omit<MenuItemType, 'onClick'> | Omit<SubMenuType, 'onClick'> | MenuItemGroupType | MenuDividerType | null) & {
  onClick?: (menuInfo: MenuInfo) => void
}

export type MenuDescriptor = {
  objType: 'background' | 'point' | 'line' | 'mesh' | CCClasses
  headerName: string,
  headerIcon?: JSX.Element,
  menuElements: MenuElement[],
}
