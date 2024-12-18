import * as THREE from 'three'


type QuadTreeNode<T extends { bb: THREE.Box2 }> = {
  nodes: [QuadTreeNode<T>, QuadTreeNode<T>, QuadTreeNode<T>, QuadTreeNode<T>] | null
  bb: THREE.Box2
  objects: T[]
}
export type QuadTree<T extends { bb: THREE.Box2 }> = {
  root: QuadTreeNode<T>
  addObject: (newObj: T) => void
  traverse: (bb: THREE.Box2, callback: (obj: T) => void) => void
}

const createNode = <T extends { bb: THREE.Box2 }>(bb: THREE.Box2) => {
  return { nodes: null, bb, objects: [] } as QuadTreeNode<T>
}

const createNodesIfNull = (node: QuadTreeNode<any>) => {
  if (node.nodes === null) {
    __center.copy(node.bb.min).add(node.bb.max).multiplyScalar(0.5)
    const bb0 = new THREE.Box2(node.bb.min.clone(), __center.clone())
    const bb1 = new THREE.Box2(new THREE.Vector2(__center.x, node.bb.min.y), new THREE.Vector2(node.bb.max.x, __center.y))
    const bb2 = new THREE.Box2(new THREE.Vector2(node.bb.min.x, __center.y), new THREE.Vector2(__center.x, node.bb.max.y))
    const bb3 = new THREE.Box2(__center.clone(), node.bb.max.clone())

    node.nodes = [
      createNode(bb0),
      createNode(bb1),
      createNode(bb2),
      createNode(bb3),
    ]
  }
}

const traverse = (node: QuadTreeNode<any>, bb: THREE.Box2, callback: (obj: any) => void) => {
  if (!bb.intersectsBox(node.bb)) {
    return
  }

  node.objects.forEach(obj => {
    if (bb.intersectsBox(obj.bb)) {
      callback(obj)
    }
  })

  node.nodes?.forEach(childNode => {
    traverse(childNode, bb, callback)
  })
}

const __center = new THREE.Vector2()
const __min = new THREE.Vector2()
const __max = new THREE.Vector2()
const __bb = new THREE.Box2()

export const createQuadTree = <T extends { bb: THREE.Box2 }>() => {
  return {
    root: createNode<T>(new THREE.Box2(new THREE.Vector2(-1.0, -1.0), new THREE.Vector2(1.0, 1.0))),
    addObject(newObj: T) {
      if (newObj.bb.max.x <= -1 || newObj.bb.max.y <= -1 || newObj.bb.min.x >= 1 || newObj.bb.min.y >= 1) {
        // Prevent adding objects which are completely outside the screen
        return
      }

      let curNode = this.root
      // Allow max tree depth === 6
      for (let i = 0; i < 5; i++) {
        __center.copy(curNode.bb.min).add(curNode.bb.max).multiplyScalar(0.5)

        const bb0 = curNode.nodes?.[0].bb || __bb.set(curNode.bb.min, __center)
        if (bb0.containsBox(newObj.bb)) {
          createNodesIfNull(curNode)
          curNode = (curNode.nodes as QuadTreeNode<T>[])[0]
          continue
        }
        
        const bb1 = curNode.nodes?.[1].bb ||
          __bb.set(__min.set(__center.x, curNode.bb.min.y), __max.set(curNode.bb.max.x, __center.y))
        if (bb1.containsBox(newObj.bb)) {
          createNodesIfNull(curNode)
          curNode = (curNode.nodes as QuadTreeNode<T>[])[1]
          continue
        }
        
        const bb2 = curNode.nodes?.[2].bb ||
          __bb.set(__min.set(curNode.bb.min.x, __center.y), __max.set(__center.x, curNode.bb.max.y))
        if (bb2.containsBox(newObj.bb)) {
          createNodesIfNull(curNode)
          curNode = (curNode.nodes as QuadTreeNode<T>[])[2]
          continue
        }
        
        const bb3 = curNode.nodes?.[3].bb || __bb.set(__center, curNode.bb.max)
        if (bb3.containsBox(newObj.bb)) {
          createNodesIfNull(curNode)
          curNode = (curNode.nodes as QuadTreeNode<T>[])[3]
          continue
        }

        break
      }
      
      curNode.objects.push(newObj)
    },
    traverse(bb: THREE.Box2, callback: (obj: T) => void) {
      traverse(this.root, bb, callback)
    },
  } as QuadTree<T>
}
