import { MenuInfo, MenuElement } from '@buerli.io/react-cad'
import { CCClasses } from '@buerli.io/classcad'
import { GraphicType } from '@buerli.io/core'

export type MenuObjType = GraphicType | CCClasses

export type CanvasMenuInfo = MenuInfo<{ clickPos: THREE.Vector3; clickNormal?: THREE.Vector3 }>

export type MenuDescriptor = {
  objType: MenuObjType
  headerName: string
  headerIcon?: JSX.Element
  menuElements: MenuElement[]
}
