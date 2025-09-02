import { MenuInfo, MenuElement } from '@buerli.io/react-cad'
import { ScgClassType, ScgGraphicType } from '@buerli.io/classcad'

export type MenuObjType = ScgGraphicType | ScgClassType

export type CanvasMenuInfo = MenuInfo<{ clickPos: THREE.Vector3; clickNormal?: THREE.Vector3; intersections: THREE.Intersection[] }>

export type MenuDescriptor = {
  objType: MenuObjType
  headerName: string
  headerIcon?: JSX.Element
  menuElements: MenuElement[]
}
