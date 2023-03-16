import {
  DrawingID,
  ObjectID,
  GeometryElement,
  ProductElement,
  getDrawing,
  BuerliScope,
  GraphicType,
  Surfaces,
  MeshGeometry,
  GraphicID,
  createGraphicItem,
  SelectedItem,
  createInfo,
  InteractionInfo,
} from '@buerli.io/core'
import { TreeObjScope, MateScope } from '@buerli.io/react-cad'

const isPoint = (intersection: THREE.Intersection) => Boolean(intersection.object?.userData?.pointMap)
const isLine = (intersection: THREE.Intersection) => Boolean(intersection.object?.userData?.lineMap)

export const findGeometryIntersection = (intersections: THREE.Intersection[], lineThreshold: number, pointThreshold: number) => {
  let index = intersections.findIndex(i => i.object.userData?.isBuerliGeometry)
  let intersection = intersections[index]
  if (!intersection) {
    return undefined
  }

  const minDist = intersection.distance
  const maxThreshold = Math.max(lineThreshold, pointThreshold)
  
  while (intersections[index].distance - minDist < maxThreshold) {
    const intersectionNext = intersections[index]
    if (isPoint(intersectionNext) && intersectionNext.distance - minDist < pointThreshold) {
      // If we find a point within point threshold, just return it
      return intersectionNext
    }
    if (!isLine(intersection) && isLine(intersectionNext) && intersectionNext.distance - minDist < lineThreshold) {
      intersection = intersectionNext
    }
    index++
  }

  return intersection
}

export const selectObject = (drawingId: DrawingID, productId: ObjectID, object: GeometryElement | null) => {
  const drawing = getDrawing(drawingId)
  const activeSelId = drawing.selection.active
  if (!object || !activeSelId) {
    return
  }

  const selection = drawing.selection.refs[drawing.selection.active]

  let prodElements: ProductElement[] = []
  if (selection.isSelectable(BuerliScope, object.container.type)) {
    // Use the container id of the element as graphicId for entity selection.
    // All elements of one entity must have the same graphicId in order to have
    // the entity selection working proper.
    prodElements = [{ ...object, type: object.container.type, graphicId: object.container.id, productId }]
  } else if (selection.isSelectable(BuerliScope, GraphicType.LOOP) && Surfaces.indexOf(object.type) >= 0) {
    // Special handling for LOOP's
    const mesh = object as MeshGeometry
    const edges: GraphicID[] = []
    if (mesh.loops) {
      const loops: GraphicID[][] = mesh.loops
      for (const loop of loops) {
        edges.push(...loop)
      }
    }
    const container = drawing.geometry.cache[mesh.container.id]
    prodElements = container ? edges.map(n => ({ ...container.map[n], productId })) : []
  } else if (selection.isSelectable(BuerliScope, object.type)) {
    prodElements = [{ ...object, productId }]
  }

  const selApi = drawing.api.selection
  const items = prodElements.map(elem => createGraphicItem(elem.productId, elem))
  const haveUnselected = items.find(item => !selApi.isItemSelected(item)) !== undefined
  if (haveUnselected) {
    selApi.select(items, activeSelId)
  } else {
    selApi.unselect(items, activeSelId)
  }
}

// TODO: Rename this function
export const convertSelToInteraction = (drawingId: DrawingID, selItems: SelectedItem[]) => {
  const curNodeId = getDrawing(drawingId).structure.currentNode
  const curProdId = getDrawing(drawingId).structure.currentProduct as ObjectID

  const interactionInfoArr = selItems.map(item => {
    switch (item.scope) {
      case BuerliScope: {
        const data = item.data
        return createInfo({
          objectId: data.container.ownerId,
          graphicId: data.graphicId,
          containerId: data.container.id,
          prodRefId: data.productId,
        })
      }
      case TreeObjScope: {
        const object = item.data.object
        return createInfo({
          objectId: object.id,
          prodRefId: curNodeId || curProdId,
        })
      }
      case MateScope: {
        const csys = item.data.csys
        const matePath = item.data.matePath
        return createInfo({
          objectId: csys.id,
          objectPath: matePath,
          prodRefId: matePath[0],
        })
      }
      default: {
        return null
      }
    }
  })

  // Remove null values from the array just in case, although there shoudn't be any... probably...
  return interactionInfoArr.filter(info => info) as InteractionInfo[]
}
