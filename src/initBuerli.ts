import { CCClasses, init, SocketIOClient, ccAPI } from '@buerli.io/classcad'
import { elements } from '@buerli.io/react'
import {
  Boolean as BooleanPlg,
  BoundingBoxInfo,
  Box,
  Chamfer,
  CircularPattern,
  Cone,
  Cylinder,
  Cylindrical,
  Expressions,
  Extrusion,
  EntityDeletion,
  Fastened,
  FastenedOrigin,
  Fillet,
  Import,
  LinearPattern,
  Measure,
  Mirror,
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
  WorkCSys,
  WorkPlane,
  WorkPoint,
} from '@buerli.io/react-cad'

const CCSERVERURL = 'ws://localhost:9091'

export const initBuerli = () => {
  console.info('initBuerli')

  init(id => {
    const socket = new SocketIOClient(CCSERVERURL, id)

    // Init settings will be called after new drawing has been connected. This happens after new Part/Assembly or loading a model.
    // This mechanism allows the application (client) to individually override settings, which have been initially made by the server. 
    const initSettings = async () => {
      await ccAPI.common.setSettings(id, {
        isGraphicEnabled: true,           // default server: true
        isCCGraphicEnabled: false,        // default server: false
        isInvisibleGraphicEnabled: true,  // default server: false
        isSketchGraphicEnabled: false,    // default server: false
        facetingParamsMode: 1,            // default server: 1
        facetingChordHeightTol: 0.1,      // default server: 0.1
        facetingAngleTol: 0               // default server: 0
      })
    }
    socket.on('connected', initSettings)
    return socket
  }, {
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
      [CCClasses.CCWorkCSys]: WorkCSys,
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
      [CCClasses.CCEntityDeletion]: EntityDeletion,
      [CCClasses.CCMirror]: Mirror,
    },
  })
}
