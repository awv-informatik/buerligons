import { CCClasses, init, SocketIOClient } from '@buerli.io/classcad'
import { api, getDrawing } from '@buerli.io/core'
import { elements } from '@buerli.io/react'
import {
  Boolean as BooleanPlg,
  BoundingBoxInfo,
  Box,
  CADApi,
  Chamfer,
  CircularPattern,
  Cone,
  Cylinder,
  Cylindrical,
  Expressions,
  Extrusion,
  Fastened,
  FastenedOrigin,
  Fillet,
  Import,
  LinearPattern,
  Measure,
  Parallel,
  Planar,
  ProductManagement,
  Revolute,
  Revolve,
  Rotate,
  Sketch,
  Slice,
  SliceBySheet,
  Slider,
  Sphere,
  TransformByCsys,
  Translate,
  WorkAxis,
  WorkCoordSystem,
  WorkPlane,
  WorkPoint,
} from '@buerli.io/react-cad'

const CCSERVERURL = 'wss://04.service.classcad.ch'
const isDev = process.env.NODE_ENV === 'development'

export const initBuerli = () => {
  console.info('initBuerli')

  // Add the app store to the window for debugging purpose.
  if (isDev) {
    const wnd = window as any
    wnd.buerliStore = api
    wnd.cadStore = CADApi
    wnd.getDrawing = () => (api.getState().drawing.active ? getDrawing(api.getState().drawing.active || '') : null)
  }

  init(id => new SocketIOClient(CCSERVERURL, id), {
    theme: {
      primary: '#e36b7c',
      secondary: '#fcc7cb',
      dark: '#a0a0a0',
      highlightedGeom: '#e36b7c',
      hoveredGeom: '#40a9ff',
    },
    config: {
      geometry: {
        disabled: false,
        edges: { hidden: false, opacity: 1.0, color: 'black' },
        points: { hidden: true, opacity: 1.0, color: 'black' },
        // meshes: { hidden: false, opacity: 1.0, wireframe: false },
      },
    },
    elements,
    globalPlugins: [Measure, BoundingBoxInfo, Expressions, ProductManagement],
    plugins: {
      [CCClasses.CCSketch]: Sketch,
      [CCClasses.CCExtrusion]: Extrusion,
      [CCClasses.CCChamfer]: Chamfer,
      [CCClasses.CCConstantRadiusFillet]: Fillet,
      [CCClasses.CCUnion]: BooleanPlg,
      [CCClasses.CCWorkAxis]: WorkAxis,
      [CCClasses.CCWorkPlane]: WorkPlane,
      [CCClasses.CCWorkPoint]: WorkPoint,
      [CCClasses.CCRevolve]: Revolve,
      [CCClasses.CCBox]: Box,
      [CCClasses.CCSphere]: Sphere,
      [CCClasses.CCCylinder]: Cylinder,
      [CCClasses.CCCone]: Cone,
      [CCClasses.CCWorkCoordSystem]: WorkCoordSystem,
      [CCClasses.CCIntersection]: BooleanPlg,
      [CCClasses.CCSubtraction]: BooleanPlg,
      [CCClasses.CCSlice]: Slice,
      [CCClasses.CCSliceBySheet]: SliceBySheet,
      [CCClasses.CCLinearPattern]: LinearPattern,
      [CCClasses.CCCircularPattern]: CircularPattern,
      [CCClasses.CCTransformationByCSys]: TransformByCsys,
      [CCClasses.CCTranslation]: Translate,
      [CCClasses.CCRotation]: Rotate,
      [CCClasses.CCFastenedOriginConstraint]: FastenedOrigin,
      [CCClasses.CCFastenedConstraint]: Fastened,
      [CCClasses.CCSliderConstraint]: Slider,
      [CCClasses.CCRevoluteConstraint]: Revolute,
      [CCClasses.CCCylindricalConstraint]: Cylindrical,
      [CCClasses.CCPlanarConstraint]: Planar,
      [CCClasses.CCParallelConstraint]: Parallel,
      [CCClasses.CCImport]: Import,
    },
  })
}
