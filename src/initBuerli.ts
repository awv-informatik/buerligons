import { CCClasses, createApi, init, WASMClient } from '@buerli.io/classcad'
import { elements } from '@buerli.io/react'
import {
  AppearanceEditor,
  Boolean as BooleanPlg,
  BoundingBoxInfo,
  Box,
  Chamfer,
  CircularPattern,
  CircularPatternConstraint,
  CompositeCurve,
  Cone,
  Cylinder,
  Cylindrical,
  Dimensions,
  EntityDeletion,
  Expressions,
  Extrusion,
  Fastened,
  FastenedOrigin,
  Fillet,
  Gear,
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

const classcadKey =
  'MS4xLlZZUG51VkNpOGdjQm50RXB0VkE1RnQ1ekVVazNOR1dYMk9weHlxRGJjazRSdGYwTFRPTFl5NVdjYmY4VnFOOXlWTDQ0OUNzSExTbmhQRHZpNEVidXRpdzIrR0d0N0JIZWk1VEhwK2xHZDJpRHhFOEJBQkEwUEFpSzd6ZXpmM0lCZzB2cklka0xkWHFQdzlzenZxTHlDUkM1N1A0MEFaQnNiSlZ4aFRGNjg2WEdkd1c0Wis0b0l1V2NXNU83ZUh6MktnTTY0Mzh3Wk4rWVlIaVBMS2sxTTFLZ2d5SUxpZGdXLzUzSXFRZks5ZkNUZk9KcjRoU3VnWUJiUGpyVzdqZkJ3cE96RGhlZWpaOHl2NkNkU3orSzlnMmJQa0xaa240akV1aDBJM0tzVUhMSmt2b1Y0dStJN2EvdUw3RHd2bUFkK29yRGdXZHFaeXpjTmlUTGltSlFFZDVsMm02L1lKN0hnOFlFeDhXaXZMVW5TZHpGaEM2UVllSGorS2lYaXdPbDZMVS95ZjEyOVNud09kbXNrRU5QbjJkSVRoTTgxL21MR0V0ajlGcytTLy9JaUs4aWhwaDBIMUsreVkwU3h5b1BmNU5veU9aRks4a1RidGRYMmNlekVpRFhhSmZ5OG9GOEtYNFpDOUxyc3F3WHdLaEdxejRtUnk5Q0pMRnBJamtCZ3FubUNzM0hMS3cvdmZwSXlndzFITXB2TU1aemc4RUY1ZDZlQkRKYS9BemJNWWVLTzFSZzNldlBrNkFGNXZLSmxIbldHYzhaazQ0MktaMXZsdzZVazM0SzdtUmVwdURNYXBURHY3Q3lOM1NkVDZ3eC9TR25NSEhydmJXUkFheG50MlhFVEpycFFIQ3RVTUhlOENidVBMeHpKUTY5NERoOVJOWTFhMFlRQnh1U0dKaU1pVUtmSjZzUUxVT2FUQ1VTNkR4YXpIM293cXcwbndpbSs0Nk1MTVlpcG4rMG9rT1NIZUc1b29JZkFteVpLaDdyVlErTUpwUW5SY0NqVXhXencyRUlCbWNaYjFmNnY1QndRWERsSWx6Nmc0VWw5Vlg1N0JscUYyMVovZy9TdjdBSE1rcGNLSWhvWHFDcWxWUkFqS1lLUmlaVHVOQk1OQnZqQllQNVVYUVVVNktFTUJLcTM1ZDA1TDk0YStSeE5rUGl5bVlhL0FpZmxwUDVFZTRXLzdKWkFqOXcrWnBYVmI5R3IrRkNPd3RDcCtDcmkzOEpDSlpQVCt4SEFnckhtcjFNc2FsVjFFbjVQdldaZ0k0ZXlVNDNmUHA3dE9rSE51UkpETjVTYXBrek1VNFNGbER2V3M2emhRY05CVGhuOW5EVmdBZ3V6eUJPN2wwK3lraytFZUFncXQzZXFEa1hkNDlqbGNEL1BEVUNYdVA0ZWRFT0VFWWxMb2w1V1o0ZDZjUlVTQ1VwdFJJWlN6dVRGc1ZPNGNTV08yRWdaaVV3MVovWWcyZnFvb2xEMFl6TGpPQjFEWkhwZlIxN2xwS2pUd2dJNTNUdUtmVGtOZFhUV3J1eU9PaE5CWjd6ZThwM1k4UlZGYWJYUTEzR1k0Qm9pYTBTVGZOOU1LaFM2ZWRJR1lXY1lGcjBxLzk0bE5OeFQwV2FPUWlIb2h3VXZWQnIrcW04UmxxM1pMMWpCWU1LWGVFclRkbzcwUXA1RTFVdTArVzhNMFdwU2dRQ3BPK2NRRll3TWwwclBmZE5SQUNPQU5DcGQ5SWRWdEphZnhQMHRJUE8xUG5wOTRYbklnSkFPdEh1aUNNT0hFaGN1Ykp1dVRBeGF0L2tBSlBKcjd5UU8xZVYybEE4WDlOM3N5MFlnU0JSK2kvd1hWTDRZcGRZKytHK25yNVBDdTJTSkRiLzZnU2NVV3JQcHJ0MENzQ3VBVTE2SHAwL1Jna1ZSWG9rVHpHMFQ1TG1QcnZmcFlCKzNQRUpDVFVPbWlldXRqczRXLy9ZbHMvMU9YdlY3WHYwVXFBODRoS3lLbnpTOXp5ak5KWmpiU0FVUHdFYW9PZkZGUEFVaXc3NXZMZ0FxRjlIVk5GbnFBeU1jOUpyUWpMYzY3ejVZYStWK2EyUFB6VVpBdVB0Vm9tV2dzanlIZXFGa2xUaFZ5RnZZei9jKzhwMkx1ODZmclRWbEJXTjFQTXRqVmhPRk1nNmFZUVBMTGhUcDkyUCtSR2I2UzY1TzVVYnpaUEF5Z1RGbnhqQVU5eHdLenJBaEdaMGRBOEJMcG05WkRWa2dhRnBVRThNUXg1NFVnNGx2cC8rbGhOOEU4aU5INVRCQWNYZkVrVUpoUkY1eEp0V1JUMm1Uc0Y3d3lMWEtmZW9nelh0SDBtNW8zMlovczdqdEQxT3ZrOTYxODlNSFVzNSsrdjZWbkNMZnBuMFcxVGdZR1NReWswSExSZlhPWHREc0lJTStFYko4Sm4rR0xoR1RRMnZQNER4NDQwN05Gb1hDZEtiNS90MUF6K25HNFNidGcwWmlMaGNkV0N4RENMeUVJSldKWVArMDREWlpmQVREcHpzazh6VkQzc3pyQ0w5MThmM0xnOHg4Y2xOWnpDZ25YajBSQmo2eitEV0pCQzBybnhDVkZrZnEzRUhOQWhLVEI0TmF6NkhkOUhiUXVxM3ljVjJYN3dINnE4bzJPdjBFdGlhbW52YmtIcVhsUkd1YWhRZ1BRPT0='

export const initBuerli = () => {
  console.info('initBuerli')

  init(
    id => {
      // const socket = new SocketIOClient(CCSERVERURL, id)
      const socket = new WASMClient(id, { appKey: classcadKey })

      // Init settings will be called after new drawing has been connected. This happens after new Part/Assembly or loading a model.
      // This mechanism allows the application (client) to individually override settings on the internal classcad database,
      // which have been initially made by the server.
      const initSettings = async () => {
        await createApi(id).v0.common.setDatabaseSettings({
          isGraphicEnabled: true, // default server: true
          isCCGraphicEnabled: false, // default server: false
          isInvisibleGraphicEnabled: true, // default server: false
          isSketchGraphicEnabled: false, // default server: false
          facetingParamsMode: 1, // default server: 1
          facetingChordHeightTol: 0.1, // default server: 0.1
          facetingAngleTol: 0, // default server: 0
          doCurveTessellation: false, // default server: false
        })
      }
      socket.on('connected', initSettings)
      return socket
    },
    {
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
      globalPlugins: [Dimensions, Measure, BoundingBoxInfo, Expressions, ProductManagement, AppearanceEditor],
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
        [CCClasses.CCCompositeCurve]: CompositeCurve,
        [CCClasses.CCTransformationByCSys]: TransformByCsys,
        [CCClasses.CCTranslation]: Translate,
        [CCClasses.CCTwist]: Twist,
        [CCClasses.CCRotation]: Rotate,
        [CCClasses.CCFastenedOriginConstraint]: FastenedOrigin,
        [CCClasses.CCFastenedConstraint]: Fastened,
        [CCClasses.CCSliderConstraint]: Slider,
        [CCClasses.CCRevoluteConstraint]: Revolute,
        [CCClasses.CCCylindricalConstraint]: Cylindrical,
        [CCClasses.CCPlanarConstraint]: Planar,
        [CCClasses.CCParallelConstraint]: Parallel,
        [CCClasses.CCSphericalConstraint]: Spherical,
        [CCClasses.CCGroupConstraint]: Group,
        [CCClasses.CCLinearPatternConstraint]: LinearPatternConstraint,
        [CCClasses.CCCircularPatternConstraint]: CircularPatternConstraint,
        [CCClasses.CCGearRelation]: Gear,
        [CCClasses.CCImport]: Import,
        [CCClasses.CCEntityDeletion]: EntityDeletion,
        [CCClasses.CCMirror]: Mirror,
      },
    },
  )
}
