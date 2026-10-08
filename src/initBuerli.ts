/* eslint-disable @typescript-eslint/ban-ts-comment */
import { createApi, init, ScgClassType, SocketIOClient, WASMClient, WSClient } from '@buerli.io/classcad'
import { DrawingID } from '@buerli.io/core'
import {
  AppearanceEditor,
  Boolean as BooleanPlg,
  BoundingBoxInfo,
  Box,
  BridgingCurve,
  Chamfer,
  CircularPattern,
  CircularPatternConstraint,
  CompositeCurve,
  Cone,
  Cylinder,
  Cylindrical,
  Dimensions,
  elements,
  EntityDeletion,
  Expressions,
  Extrusion,
  Fastened,
  FastenedOrigin,
  Fillet,
  Gear,
  getStage,
  Group,
  Import,
  LinearPattern,
  LinearPatternConstraint,
  Measure,
  Mirror,
  Parallel,
  Planar,
  ProductManagement,
  Revolute,
  Revolve,
  Rotate,
  SessionManagement,
  Sketch,
  Slice,
  SliceBySheet,
  Slider,
  Sphere,
  Spherical,
  TransformByCsys,
  Translate,
  Twist,
  WorkAxis,
  WorkCSys,
  WorkPlane,
  WorkPoint,
} from '@buerli.io/react-cad'

import { setRunsInPage } from './engine'

export const initBuerli = (
  callback = (id: DrawingID): WASMClient | SocketIOClient | WSClient => {
    throw new Error('Client factory not implemented')
  },
) => {
  console.info('initBuerli')
  // The stage's colours are the theme's (and follow it: the app's frame keeps the edges in step).
  const stage = getStage()
  init(
    id => {
      const socket = callback(id)
      setRunsInPage(id, socket instanceof WASMClient)
      // Init settings will be called after new drawing has been connected. This happens after new Part/Assembly or loading a model.
      // This mechanism allows the application (client) to individually override settings on the internal classcad database,
      // which have been initially made by the server.
      const initSettings = async () => {
        await createApi(id).v1.common.setDatabaseSettings({
          isGraphicEnabled: true, // default server: true
          isCCGraphicEnabled: false, // default server: false
          isInvisibleGraphicEnabled: true, // default server: false
          isSketchGraphicEnabled: false, // default server: false
          facetingParamsMode: 1, // default server: 1
          chordHeightTol: 0.1, // default server: 0.1
          angleTol: 0, // default server: 0
          doCurveTessellation: false, // default server: false
        })
      }
      socket.on('connected', initSettings)
      return socket
    },
    {
      theme: {
        primary: stage.pick,
        secondary: stage.hover,
        dark: stage.datum,
        highlightedGeom: stage.select,
        hoveredGeom: stage.hover,
      },
      config: {
        geometry: {
          disabled: false,
          edges: { hidden: false, opacity: 1.0, color: stage.edge },
          points: { hidden: true, opacity: 1.0, color: stage.edge },
          // meshes: { hidden: false, opacity: 1.0, wireframe: false },
        },
      },
      elements,
      globalPlugins: [Dimensions, Measure, BoundingBoxInfo, Expressions, ProductManagement, AppearanceEditor, SessionManagement],
      plugins: {
        [ScgClassType.CCSketch]: Sketch,
        [ScgClassType.CCExtrusion]: Extrusion,
        [ScgClassType.CCChamfer]: Chamfer,
        [ScgClassType.CCConstantRadiusFillet]: Fillet,
        [ScgClassType.CCUnion]: BooleanPlg,
        [ScgClassType.CCWorkAxis]: WorkAxis,
        [ScgClassType.CCWorkPlane]: WorkPlane,
        [ScgClassType.CCWorkPoint]: WorkPoint,
        [ScgClassType.CCRevolve]: Revolve,
        [ScgClassType.CCBox]: Box,
        [ScgClassType.CCSphere]: Sphere,
        [ScgClassType.CCCylinder]: Cylinder,
        [ScgClassType.CCCone]: Cone,
        [ScgClassType.CCWorkCSys]: WorkCSys,
        [ScgClassType.CCIntersection]: BooleanPlg,
        [ScgClassType.CCSubtraction]: BooleanPlg,
        [ScgClassType.CCSlice]: Slice,
        [ScgClassType.CCSliceBySheet]: SliceBySheet,
        [ScgClassType.CCLinearPattern]: LinearPattern,
        [ScgClassType.CCCircularPattern]: CircularPattern,
        [ScgClassType.CCCompositeCurve]: CompositeCurve,
        [ScgClassType.CCBridgingCurve]: BridgingCurve,
        [ScgClassType.CCTransformationByCSys]: TransformByCsys,
        [ScgClassType.CCTranslation]: Translate,
        [ScgClassType.CCTwist]: Twist,
        [ScgClassType.CCRotation]: Rotate,
        [ScgClassType.CCFastenedOriginConstraint]: FastenedOrigin,
        [ScgClassType.CCFastenedConstraint]: Fastened,
        [ScgClassType.CCSliderConstraint]: Slider,
        [ScgClassType.CCRevoluteConstraint]: Revolute,
        [ScgClassType.CCCylindricalConstraint]: Cylindrical,
        [ScgClassType.CCPlanarConstraint]: Planar,
        [ScgClassType.CCParallelConstraint]: Parallel,
        [ScgClassType.CCSphericalConstraint]: Spherical,
        [ScgClassType.CCGroupConstraint]: Group,
        [ScgClassType.CCLinearPatternConstraint]: LinearPatternConstraint,
        [ScgClassType.CCCircularPatternConstraint]: CircularPatternConstraint,
        [ScgClassType.CCGearRelation]: Gear,
        [ScgClassType.CCImport]: Import,
        [ScgClassType.CCEntityDeletion]: EntityDeletion,
        [ScgClassType.CCMirror]: Mirror,
      },
    },
  )
}
