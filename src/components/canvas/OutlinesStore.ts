
import * as THREE from 'three'
import create from 'zustand'

import { ObjectID } from '@buerli.io/core'

export const useOutlinesStore = create<{
  outlinedMeshes: { [key: number]: THREE.Object3D[]}
  setOutlinedMeshes: (id: ObjectID, outlinedMeshes: THREE.Object3D[]) => void
  removeMesh: (id: ObjectID) => void
}>((set, get) => ({
  outlinedMeshes: {},
  setOutlinedMeshes: (id: ObjectID, outlinedMeshes_: THREE.Object3D[]) =>
    set(state => ({ outlinedMeshes: { ...state.outlinedMeshes, [id]: outlinedMeshes_ } })),
  removeMesh: (id: ObjectID) =>
    set(state => {
      const outlinedMeshes_ = { ...state.outlinedMeshes }
      delete outlinedMeshes_[id]
      return { outlinedMeshes: outlinedMeshes_ }
    }),
}))
