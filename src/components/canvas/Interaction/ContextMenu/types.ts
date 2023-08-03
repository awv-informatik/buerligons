import { MenuInfo, MenuElement } from '@buerli.io/react-cad'
import { CCClasses } from '@buerli.io/classcad'

export type MenuObjType = 'point' | 'line' | 'mesh' | CCClasses

export type CanvasMenuInfo = MenuInfo<{ clickPos: THREE.Vector3; clickNormal?: THREE.Vector3 }>

export type MenuDescriptor = {
  objType: MenuObjType
  headerName: string,
  headerIcon?: JSX.Element,
  menuElements: MenuElement[],
}
