import { api, getDrawing, init } from '@buerli.io/core'
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
  Slider,
  Sphere,
  TransformByCsys,
  Translate,
  WorkAxis,
  WorkCoordSystem,
  WorkPlane,
  WorkPoint,
} from '@buerli.io/react-cad'

const CCSERVERURL = 'ws://localhost:8182'
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

  init({
    url: CCSERVERURL,
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
      CC_Sketch: Sketch,
      CC_Extrusion: Extrusion,
      CC_Revolve: Revolve,
      CC_Box: Box,
      CC_Sphere: Sphere,
      CC_Cylinder: Cylinder,
      CC_Cone: Cone,
      CC_WorkPoint: WorkPoint,
      CC_WorkPlane: WorkPlane,
      CC_WorkAxis: WorkAxis,
      CC_WorkCoordSystem: WorkCoordSystem,
      CC_Union: BooleanPlg,
      CC_Intersection: BooleanPlg,
      CC_Subtraction: BooleanPlg,
      CC_ConstantRadiusFillet: Fillet,
      CC_Chamfer: Chamfer,
      CC_Slice: Slice,
      CC_LinearPattern: LinearPattern,
      CC_CircularPattern: CircularPattern,
      CC_TransformationByCSys: TransformByCsys,
      CC_Translation: Translate,
      CC_Rotation: Rotate,
      CC_Import: Import,
      CC_FastenedOriginConstraint: FastenedOrigin,
      CC_FastenedConstraint: Fastened,
      CC_SliderConstraint: Slider,
      CC_RevoluteConstraint: Revolute,
      CC_CylindricalConstraint: Cylindrical,
      CC_PlanarConstraint: Planar,
      CC_ParallelConstraint: Parallel,
    },
  })
}

export default initBuerli
