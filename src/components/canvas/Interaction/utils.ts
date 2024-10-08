import {
  DrawingID,
  ObjectID,
  GeometryElement,
  ProductElement,
  getDrawing,
  BuerliScope,
  GraphicType,
  MeshTypes,
  MeshGeometry,
  GraphicID,
  createGraphicItem,
  SelectedItem,
  createInfo,
  InteractionInfo,
} from '@buerli.io/core'
import { TreeObjScope, MateScope, createTreeObjSelItem } from '@buerli.io/react-cad'
import { CCClasses, ccUtils } from '@buerli.io/classcad'

export const isBPoint = (intersection: THREE.Intersection) => Boolean(intersection.object?.userData?.pointMap)
export const isBLine = (intersection: THREE.Intersection) => Boolean(intersection.object?.userData?.lineMap)

export const isSketchActive = (drawingId: DrawingID) => {
  const drawing = getDrawing(drawingId)
  const active = drawing.plugin.refs[drawing.plugin.active.feature || -1]
  const objClass = drawing.structure.tree[active?.id || -1]?.class || ''

  return ccUtils.base.isA(objClass, CCClasses.CCSketch)
}

export const getBuerliGeometry = (intersection: THREE.Intersection | undefined) => {
  const uData = intersection?.object?.userData
  const index = intersection?.index ?? -1
  const faceIndex = intersection?.faceIndex ?? -1

  return (uData?.pointMap?.[index] || uData?.lineMap?.[index] || uData?.meshMap?.[faceIndex]) as GeometryElement | undefined
}

export const findGeometryIntersection = (intersections: THREE.Intersection[], lineThreshold: number, pointThreshold: number) => {
  if (intersections.some(i => i.object.userData?.onHUD)) {
    // If there is an object on HUD within intersections, consider there are no geometry intersections
    return undefined
  }

  let index = intersections.findIndex(i => i.object.userData?.isBuerliGeometry)
  let intersection = intersections[index]
  if (!intersection) {
    return undefined
  }

  const minDist = intersection.distance
  const maxThreshold = Math.max(lineThreshold, pointThreshold)
  
  while (intersections[index].distance - minDist < maxThreshold) {
    const intersectionNext = intersections[index]
    if (isBPoint(intersectionNext) && intersectionNext.distance - minDist < pointThreshold) {
      // If we find a point within point threshold, just return it
      return intersectionNext
    }
    if (!isBLine(intersection) && isBLine(intersectionNext) && intersectionNext.distance - minDist < lineThreshold) {
      intersection = intersectionNext
    }
    index++
  }

  return intersection
}

export const attemptSSelection = (drawingId: DrawingID, productId: ObjectID, object: GeometryElement | null) => {
  const drawing = getDrawing(drawingId)
  const tree = drawing.structure.tree
  const selApi = drawing.api.selection
  const activeSelId = drawing.selection.active
  if (!object || !activeSelId) {
    return
  }

  const selection = drawing.selection.refs[drawing.selection.active]

  const curProdId = drawing.structure.currentProduct || -1
  const instanceId = ccUtils.assembly.getMatePath(drawingId, productId).pop() || -1
  const instance = tree[instanceId]
  if (instance && selection.isSelectable(TreeObjScope, { object: instance })) {
    const selItem = createTreeObjSelItem(curProdId, instance)
    if (selApi.isItemSelected(selItem)) {
      selApi.unselect([selItem], activeSelId)
    } else {
      selApi.select([selItem], activeSelId)
    }

    return
  }

  let prodElements: ProductElement[] = []
  if (selection.isSelectable(BuerliScope, object.container.type)) {
    // Use the container id of the element as graphicId for entity selection.
    // All elements of one entity must have the same graphicId in order to have
    // the entity selection working proper.
    prodElements = [{ ...object, type: object.container.type, graphicId: object.container.id, productId }]
  } else if (selection.isSelectable(BuerliScope, GraphicType.LOOP) && MeshTypes.indexOf(object.type) >= 0) {
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
  else {
    // If the object can't be selected, consider it a 'miss', and unselect everything
    selApi.unselectAll()
    return
  }

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
  const curInstanceId = getDrawing(drawingId).structure.currentInstance
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
          prodRefId: curInstanceId || curProdId,
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
